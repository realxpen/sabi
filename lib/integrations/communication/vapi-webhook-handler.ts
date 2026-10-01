import { createHash, timingSafeEqual } from "node:crypto";
import {
  createNeonCommunicationEventDeduplicatorFromEnvironment,
  type NeonCommunicationEventDedupeSql
} from "../neon/communication-event-deduplicator";
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

  if (actualBytes.length !== expectedBytes.length) {
    return false;
  }

  return timingSafeEqual(actualBytes, expectedBytes);
}

function isAuthorized(request: Request, environment: VapiWebhookEnvironment): boolean {
  const expected = environment.VAPI_WEBHOOK_TOKEN?.trim();
  const match = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i);
  const presented = match?.[1]?.trim();

  return Boolean(
    expected && presented && safeSecretEquals(presented, expected)
  );
}

function eventIdForRawBody(rawBody: Uint8Array): string {
  return `vapi-${createHash("sha256").update(rawBody).digest("hex")}`;
}

/**
 * Authenticated Vapi webhook used for live call lifecycle evidence.
 *
 * Vapi is configured with a saved Bearer-token Custom Credential pointing at
 * this route. The handler never trusts transcript text as Quote data. It only
 * normalizes communication state, validates mission/provider correlation from
 * server-supplied assistantOverrides.variableValues, and deduplicates exact
 * webhook retries in Neon.
 */
export function createVapiWebhookPostHandler(
  environment: VapiWebhookEnvironment = process.env,
  fetchImpl: VapiKrosFetch = fetch,
  sql?: NeonCommunicationEventDedupeSql
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
        deduplicator
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
