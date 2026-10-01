import { createHash, timingSafeEqual } from "node:crypto";
import {
  createNeonCommunicationEventDeduplicatorFromEnvironment,
  type NeonCommunicationEventDedupeSql
} from "../neon/communication-event-deduplicator";
import { persistCommunicationResultToMission } from "../../mission/communication-runtime-sink";
import { processCommunicationEvent } from "./event-processor";
import {
  extractVapiEventCorrelation,
  VapiKrosCommunicationAdapter,
  type VapiKrosEnvironment,
  type VapiKrosFetch
} from "./vapi-kros";

export type VapiWebhookEnvironment = VapiKrosEnvironment;

function safeSecretEquals(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(actualBytes, expectedBytes);
}

function isAuthorized(request: Request, environment: VapiWebhookEnvironment): boolean {
  const expected = environment.VAPI_WEBHOOK_TOKEN?.trim();
  const match = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i);
  const presented = match?.[1]?.trim();
  return Boolean(expected && presented && safeSecretEquals(presented, expected));
}

function eventIdForRawBody(rawBody: Uint8Array): string {
  return `vapi-${createHash("sha256").update(rawBody).digest("hex")}`;
}

function extractVapiCallId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const message = (payload as { message?: unknown }).message;
  if (!message || typeof message !== "object") return undefined;
  const call = (message as { call?: unknown }).call;
  if (!call || typeof call !== "object") return undefined;
  const id = (call as { id?: unknown }).id;
  return typeof id === "string" && id.trim() ? id.trim() : undefined;
}

type VapiCallVerification =
  | { kind: "VERIFIED"; callId: string }
  | { kind: "UNKNOWN_CALL"; callId: string }
  | { kind: "UNAVAILABLE" };

async function verifyVapiCall(
  payload: unknown,
  environment: VapiWebhookEnvironment,
  fetchImpl: VapiKrosFetch
): Promise<VapiCallVerification> {
  const callId = extractVapiCallId(payload);
  const apiBaseUrl = environment.VAPI_API_BASE_URL?.trim();
  const apiKey = environment.VAPI_API_KEY?.trim();
  const assistantId = environment.VAPI_ASSISTANT_ID?.trim();

  if (!callId || !apiBaseUrl || !apiKey || !assistantId) {
    return { kind: "UNAVAILABLE" };
  }

  let response: Response;
  try {
    response = await fetchImpl(`${apiBaseUrl}/call/${encodeURIComponent(callId)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      cache: "no-store"
    });
  } catch {
    return { kind: "UNAVAILABLE" };
  }

  if (response.status === 404) return { kind: "UNKNOWN_CALL", callId };
  if (!response.ok) return { kind: "UNAVAILABLE" };

  let decoded: unknown;
  try {
    decoded = await response.json();
  } catch {
    return { kind: "UNAVAILABLE" };
  }

  if (!decoded || typeof decoded !== "object") return { kind: "UNAVAILABLE" };
  const record = decoded as { id?: unknown; assistantId?: unknown };
  const returnedCallId = typeof record.id === "string" ? record.id.trim() : undefined;
  const returnedAssistantId =
    typeof record.assistantId === "string" ? record.assistantId.trim() : undefined;

  if (returnedCallId !== callId || returnedAssistantId !== assistantId) {
    return { kind: "UNKNOWN_CALL", callId };
  }

  return { kind: "VERIFIED", callId };
}

/**
 * Authenticated Vapi webhook for live call evidence.
 *
 * A PROCESSED result is not acknowledged until it has also been written into
 * Xpen's persisted Mission state. If persistence fails, event-processor releases
 * the Neon idempotency claim and this endpoint returns 500, allowing a provider
 * retry to safely re-attempt the Mission Control update.
 */
export function createVapiWebhookPostHandler(
  environment: VapiWebhookEnvironment = process.env,
  fetchImpl: VapiKrosFetch = fetch,
  sql?: NeonCommunicationEventDedupeSql,
  onProcessed = persistCommunicationResultToMission
) {
  return async function post(request: Request): Promise<Response> {
    if (environment.SABI_COMMUNICATION_MODE?.trim() !== "vapi-kros") {
      return Response.json(
        { ok: false, error: "VAPI_LIVE_COMMUNICATION_NOT_ENABLED" },
        { status: 503 }
      );
    }

    if (!environment.VAPI_WEBHOOK_TOKEN?.trim()) {
      return Response.json(
        { ok: false, error: "VAPI_WEBHOOK_AUTH_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    if (!isAuthorized(request, environment)) {
      return Response.json(
        { ok: false, error: "INVALID_VAPI_WEBHOOK_AUTH" },
        { status: 401 }
      );
    }

    const rawBody = new Uint8Array(await request.arrayBuffer());
    let payload: unknown;

    try {
      payload = JSON.parse(new TextDecoder().decode(rawBody));
    } catch {
      return Response.json(
        { ok: false, error: "MALFORMED_VAPI_WEBHOOK_PAYLOAD" },
        { status: 400 }
      );
    }

    const correlation = extractVapiEventCorrelation(payload);
    const eventId = eventIdForRawBody(rawBody);

    if (!correlation) {
      return Response.json(
        { ok: true, kind: "UNKNOWN_CORRELATION", eventId },
        { status: 202 }
      );
    }

    const callVerification = await verifyVapiCall(payload, environment, fetchImpl);

    if (callVerification.kind === "UNKNOWN_CALL") {
      return Response.json(
        {
          ok: true,
          kind: "UNKNOWN_CALL",
          eventId,
          callId: callVerification.callId
        },
        { status: 202 }
      );
    }

    if (callVerification.kind === "UNAVAILABLE") {
      return Response.json(
        { ok: false, error: "VAPI_CALL_VERIFICATION_FAILED" },
        { status: 503 }
      );
    }

    let deduplicator;
    try {
      deduplicator = createNeonCommunicationEventDeduplicatorFromEnvironment(
        environment,
        sql
      );
    } catch {
      return Response.json(
        { ok: false, error: "VAPI_WEBHOOK_STORAGE_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    if (!deduplicator) {
      return Response.json(
        { ok: false, error: "VAPI_WEBHOOK_STORAGE_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    try {
      const result = await processCommunicationEvent({
        eventId,
        payload,
        adapter: new VapiKrosCommunicationAdapter(environment, fetchImpl),
        correlation,
        deduplicator,
        onProcessed
      });

      switch (result.kind) {
        case "UNKNOWN_CORRELATION":
          return Response.json(
            { ok: true, kind: result.kind, eventId: result.eventId },
            { status: 202 }
          );
        case "DUPLICATE":
          return Response.json(
            { ok: true, kind: result.kind, eventId: result.eventId },
            { status: 200 }
          );
        case "PROCESSED":
          return Response.json(
            {
              ok: true,
              kind: result.kind,
              eventId: result.eventId,
              communication: result.communication,
              missionPersisted: true,
              quoteCreated: false
            },
            { status: 200 }
          );
      }
    } catch {
      return Response.json(
        { ok: false, error: "VAPI_WEBHOOK_PROCESSING_FAILED" },
        { status: 500 }
      );
    }
  };
}
