import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  communicationResultSchema,
  type CommunicationResult,
  type CommunicationStatus
} from "../../schemas";
import type { CommunicationCorrelationRepository } from "../../repositories/communication-correlation-repository";
import {
  createNeonCommunicationCorrelationRepositoryFromEnvironment,
  type NeonCommunicationCorrelationEnvironment,
  type NeonCommunicationCorrelationSql
} from "../neon/communication-correlation-repository";
import {
  createNeonCommunicationEventDeduplicatorFromEnvironment,
  type NeonCommunicationEventDedupeSql
} from "../neon/communication-event-deduplicator";

export type VoicebipWebhookEnvironment =
  NeonCommunicationCorrelationEnvironment & {
    [key: string]: string | undefined;
  };

const eventSchema = z.object({
  event_id: z.string().trim().min(1),
  event_type: z.string().trim().min(1),
  channel: z.literal("sms"),
  agent_id: z.string().trim().min(1),
  number: z.string().trim().min(1).optional(),
  from: z.string().trim().min(1).optional(),
  timestamp: z.string().datetime(),
  payload: z.record(z.unknown())
});

const messagePayloadSchema = z.object({
  message_id: z.string().trim().min(1),
  status: z.string().trim().min(1).optional(),
  error_code: z.union([z.string(), z.number()]).optional()
}).passthrough();

function secretEquals(actual: string, expected: string): boolean {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function expectedSignature(
  timestamp: string,
  rawBody: Uint8Array,
  secret: string
): string {
  const digest = createHmac("sha256", secret)
    .update(timestamp)
    .update(".")
    .update(rawBody)
    .digest("hex");
  return `sha256=${digest}`;
}

function signatureValid(
  request: Request,
  rawBody: Uint8Array,
  environment: VoicebipWebhookEnvironment,
  nowMs: number
): boolean {
  const timestamp = request.headers.get("x-voicebip-timestamp")?.trim();
  if (!timestamp || !/^\d+$/.test(timestamp)) return false;

  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs)) return false;
  if (Math.abs(nowMs - timestampMs) > 300_000) return false;

  const currentSecret =
    environment.VOICEBIP_WEBHOOK_SIGNING_SECRET?.trim();
  if (!currentSecret) return false;

  const currentSignature =
    request.headers.get("x-voicebip-signature")?.trim();
  if (
    currentSignature &&
    secretEquals(
      currentSignature,
      expectedSignature(timestamp, rawBody, currentSecret)
    )
  ) {
    return true;
  }

  const previousSecret =
    environment.VOICEBIP_WEBHOOK_SIGNING_SECRET_PREVIOUS?.trim();
  const previousSignature =
    request.headers.get("x-voicebip-signature-previous")?.trim();

  return Boolean(
    previousSecret &&
      previousSignature &&
      secretEquals(
        previousSignature,
        expectedSignature(timestamp, rawBody, previousSecret)
      )
  );
}

function resultStatus(
  eventType: string,
  providerStatus: string | undefined
): { status: CommunicationStatus; errorCode?: string } | undefined {
  switch (eventType) {
    case "message.sent":
      return { status: "INITIATED" };
    case "message.delivered":
    case "message.read":
      return { status: "COMPLETED" };
    case "message.failed":
    case "message.send_failed":
      return { status: "FAILED" };
    case "message.dlr":
      return providerStatus?.toUpperCase() === "DELIVRD"
        ? { status: "COMPLETED" }
        : {
            status: "FAILED",
            errorCode: providerStatus
              ? `VOICEBIP_DLR_${providerStatus.toUpperCase()}`
              : "VOICEBIP_DLR_FAILED"
          };
    default:
      return undefined;
  }
}

function buildResult(
  event: z.infer<typeof eventSchema>,
  payload: z.infer<typeof messagePayloadSchema>,
  correlation: NonNullable<
    Awaited<ReturnType<CommunicationCorrelationRepository["getByExternalId"]>>
  >
): CommunicationResult | undefined {
  const mapped = resultStatus(event.event_type, payload.status);
  if (!mapped) return undefined;

  const errorCode =
    mapped.status === "FAILED"
      ? mapped.errorCode ??
        (payload.error_code !== undefined
          ? `VOICEBIP_${String(payload.error_code)}`
          : "VOICEBIP_MESSAGE_FAILED")
      : undefined;

  return communicationResultSchema.parse({
    id: correlation.communicationId,
    missionId: correlation.missionId,
    providerId: correlation.providerId,
    channel: "SMS",
    status: mapped.status,
    externalId: payload.message_id,
    summary:
      mapped.status === "COMPLETED"
        ? "Verified Voicebip/Temlio delivery event received. Delivery status alone does not create a Quote."
        : mapped.status === "FAILED"
          ? "Verified Voicebip/Temlio failure event received. No Quote evidence was produced."
          : "Verified Voicebip/Temlio message lifecycle event received; delivery remains pending.",
    errorCode,
    occurredAt: event.timestamp
  });
}

export function createVoicebipWebhookPostHandler(
  environment: VoicebipWebhookEnvironment = process.env,
  correlationSql?: NeonCommunicationCorrelationSql,
  dedupeSql?: NeonCommunicationEventDedupeSql,
  explicitCorrelationRepository?: CommunicationCorrelationRepository,
  now: () => number = Date.now
) {
  return async function post(request: Request): Promise<Response> {
    if (environment.SABI_MESSAGE_MODE?.trim() !== "voicebip-temlio") {
      return Response.json(
        { ok: false, error: "VOICEBIP_MESSAGE_RUNTIME_NOT_ENABLED" },
        { status: 503 }
      );
    }

    if (!environment.VOICEBIP_WEBHOOK_SIGNING_SECRET?.trim()) {
      return Response.json(
        { ok: false, error: "VOICEBIP_WEBHOOK_AUTH_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    const rawBody = new Uint8Array(await request.arrayBuffer());

    if (!signatureValid(request, rawBody, environment, now())) {
      return Response.json(
        { ok: false, error: "INVALID_VOICEBIP_WEBHOOK_SIGNATURE" },
        { status: 401 }
      );
    }

    let event: z.infer<typeof eventSchema>;
    try {
      event = eventSchema.parse(
        JSON.parse(new TextDecoder().decode(rawBody))
      );
    } catch {
      return Response.json(
        { ok: false, error: "MALFORMED_VOICEBIP_WEBHOOK_PAYLOAD" },
        { status: 400 }
      );
    }

    const headerEventId =
      request.headers.get("x-voicebip-event-id")?.trim();

    if (!headerEventId || headerEventId !== event.event_id) {
      return Response.json(
        { ok: false, error: "VOICEBIP_EVENT_ID_MISMATCH" },
        { status: 400 }
      );
    }

    const configuredAgentId = environment.VOICEBIP_AGENT_ID?.trim();
    if (configuredAgentId && event.agent_id !== configuredAgentId) {
      return Response.json(
        {
          ok: true,
          kind: "UNKNOWN_AGENT",
          eventId: event.event_id
        },
        { status: 202 }
      );
    }

    const messagePayload = messagePayloadSchema.safeParse(event.payload);
    if (!messagePayload.success) {
      return Response.json(
        {
          ok: true,
          kind: "UNSUPPORTED_EVENT",
          eventId: event.event_id
        },
        { status: 202 }
      );
    }

    const mapped = resultStatus(
      event.event_type,
      messagePayload.data.status
    );
    if (!mapped) {
      return Response.json(
        {
          ok: true,
          kind: "UNSUPPORTED_EVENT",
          eventId: event.event_id
        },
        { status: 202 }
      );
    }

    let correlationRepository = explicitCorrelationRepository;
    if (!correlationRepository) {
      try {
        correlationRepository =
          createNeonCommunicationCorrelationRepositoryFromEnvironment(
            environment,
            correlationSql
          );
      } catch {
        return Response.json(
          {
            ok: false,
            error: "VOICEBIP_CORRELATION_STORAGE_NOT_CONFIGURED"
          },
          { status: 503 }
        );
      }
    }

    if (!correlationRepository) {
      return Response.json(
        {
          ok: false,
          error: "VOICEBIP_CORRELATION_STORAGE_NOT_CONFIGURED"
        },
        { status: 503 }
      );
    }

    let correlation;
    try {
      correlation = await correlationRepository.getByExternalId(
        messagePayload.data.message_id
      );
    } catch {
      return Response.json(
        {
          ok: false,
          error: "VOICEBIP_CORRELATION_STORAGE_UNAVAILABLE"
        },
        { status: 503 }
      );
    }

    if (!correlation) {
      return Response.json(
        {
          ok: true,
          kind: "UNKNOWN_CORRELATION",
          eventId: event.event_id,
          externalId: messagePayload.data.message_id
        },
        { status: 202 }
      );
    }

    let deduplicator;
    try {
      deduplicator =
        createNeonCommunicationEventDeduplicatorFromEnvironment(
          environment,
          dedupeSql
        );
    } catch {
      return Response.json(
        { ok: false, error: "VOICEBIP_DEDUPE_STORAGE_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    if (!deduplicator) {
      return Response.json(
        { ok: false, error: "VOICEBIP_DEDUPE_STORAGE_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    const eventKey = `voicebip-${event.event_id}`;

    let claimed: boolean;
    try {
      claimed = await deduplicator.claim(eventKey);
    } catch {
      return Response.json(
        { ok: false, error: "VOICEBIP_DEDUPE_STORAGE_UNAVAILABLE" },
        { status: 503 }
      );
    }

    if (!claimed) {
      return Response.json({
        ok: true,
        kind: "DUPLICATE",
        eventId: event.event_id
      });
    }

    try {
      const communication = buildResult(
        event,
        messagePayload.data,
        correlation
      );

      if (!communication) {
        await deduplicator.release(eventKey);
        return Response.json(
          {
            ok: true,
            kind: "UNSUPPORTED_EVENT",
            eventId: event.event_id
          },
          { status: 202 }
        );
      }

      return Response.json({
        ok: true,
        kind: "PROCESSED",
        eventId: event.event_id,
        communication,
        quoteCreated: false
      });
    } catch {
      try {
        await deduplicator.release(eventKey);
      } catch {
        // The original processing error remains authoritative.
      }

      return Response.json(
        { ok: false, error: "VOICEBIP_WEBHOOK_PROCESSING_FAILED" },
        { status: 500 }
      );
    }
  };
}
