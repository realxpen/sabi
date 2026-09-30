import {
  handleCommunicationWebhook,
  WebhookConfigurationError,
  type HandleCommunicationWebhookInput
} from "../../../../lib/integrations/communication/webhook";

export const runtime = "nodejs";

type KrosWebhookDependencies = Omit<
  HandleCommunicationWebhookInput,
  "rawBody" | "signature"
>;

function notConfigured(): never {
  throw new WebhookConfigurationError(
    "Kros webhook verification/runtime contract is not configured."
  );
}

const unconfiguredDependencies: KrosWebhookDependencies = {
  verifier: {
    async verify() {
      return notConfigured();
    }
  },
  parser: {
    async parse() {
      return notConfigured();
    }
  },
  correlationResolver: {
    async resolve() {
      return notConfigured();
    }
  },
  adapter: {
    name: "krosai-unconfigured",
    async initiateContact() {
      return notConfigured();
    },
    async normalizeEvent() {
      return notConfigured();
    }
  },
  deduplicator: {
    async claim() {
      return notConfigured();
    },
    async release() {
      return notConfigured();
    }
  }
};

/**
 * Factory kept public so the complete webhook contract can be tested with
 * verified/in-memory test doubles without pretending we know Kros's live
 * signature algorithm or envelope schema.
 */
export function createKrosWebhookPostHandler(
  dependencies: KrosWebhookDependencies
) {
  return async function POST(request: Request): Promise<Response> {
    const rawBody = new Uint8Array(await request.arrayBuffer());
    const signature = request.headers.get("x-webhook-signature");

    try {
      const result = await handleCommunicationWebhook({
        rawBody,
        signature,
        ...dependencies
      });

      switch (result.kind) {
        case "UNAUTHORIZED":
          return Response.json(
            { ok: false, error: "INVALID_WEBHOOK_SIGNATURE" },
            { status: 401 }
          );
        case "MALFORMED":
          return Response.json(
            { ok: false, error: "MALFORMED_WEBHOOK_PAYLOAD" },
            { status: 400 }
          );
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
            { ok: true, kind: result.kind, eventId: result.eventId },
            { status: 200 }
          );
      }
    } catch (error) {
      if (error instanceof WebhookConfigurationError) {
        return Response.json(
          { ok: false, error: "KROSAI_WEBHOOK_NOT_CONFIGURED" },
          { status: 503 }
        );
      }

      return Response.json(
        { ok: false, error: "KROSAI_WEBHOOK_PROCESSING_FAILED" },
        { status: 500 }
      );
    }
  };
}

/**
 * Production route fails closed until the verified Kros signature algorithm,
 * live envelope parser, correlation store, durable deduplicator, and adapter
 * are supplied.
 */
export const POST = createKrosWebhookPostHandler(unconfiguredDependencies);
