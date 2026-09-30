import { z } from "zod";
import type { CommunicationAdapter } from "./types";
import {
  processCommunicationEvent,
  type CommunicationCorrelation,
  type CommunicationEventDeduplicator,
  type ProcessCommunicationEventResult
} from "./event-processor";

const webhookEnvelopeSchema = z.object({
  eventId: z.string().trim().min(1),
  correlationKey: z.string().trim().min(1),
  payload: z.unknown()
});

export type CommunicationWebhookEnvelope = z.infer<
  typeof webhookEnvelopeSchema
>;

export interface WebhookSignatureVerifier {
  verify(input: {
    rawBody: Uint8Array;
    signature: string | null;
  }): Promise<boolean>;
}

/**
 * Provider-specific parsers convert their verified webhook envelope into this
 * small internal shape. The parser interface intentionally does not prescribe
 * any partner field names.
 */
export interface WebhookEnvelopeParser {
  parse(rawBody: Uint8Array): Promise<unknown>;
}

export interface WebhookCorrelationResolver {
  resolve(correlationKey: string): Promise<CommunicationCorrelation | undefined>;
}

export class WebhookConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookConfigurationError";
  }
}

export type HandleCommunicationWebhookResult =
  | ProcessCommunicationEventResult
  | {
      kind: "UNAUTHORIZED";
    }
  | {
      kind: "MALFORMED";
    };

export type HandleCommunicationWebhookInput = {
  rawBody: Uint8Array;
  signature: string | null;
  verifier: WebhookSignatureVerifier;
  parser: WebhookEnvelopeParser;
  correlationResolver: WebhookCorrelationResolver;
  adapter: CommunicationAdapter;
  deduplicator: CommunicationEventDeduplicator;
};

/**
 * Provider-neutral webhook pipeline.
 *
 * Order is deliberate: preserve raw bytes -> verify authenticity -> parse the
 * provider envelope -> resolve correlation -> deduplicate/normalize.
 */
export async function handleCommunicationWebhook(
  input: HandleCommunicationWebhookInput
): Promise<HandleCommunicationWebhookResult> {
  const verified = await input.verifier.verify({
    rawBody: input.rawBody,
    signature: input.signature
  });

  if (!verified) {
    return { kind: "UNAUTHORIZED" };
  }

  let decoded: unknown;

  try {
    decoded = await input.parser.parse(input.rawBody);
  } catch {
    return { kind: "MALFORMED" };
  }

  const envelope = webhookEnvelopeSchema.safeParse(decoded);

  if (!envelope.success) {
    return { kind: "MALFORMED" };
  }

  const correlation = await input.correlationResolver.resolve(
    envelope.data.correlationKey
  );

  return processCommunicationEvent({
    eventId: envelope.data.eventId,
    payload: envelope.data.payload,
    adapter: input.adapter,
    correlation,
    deduplicator: input.deduplicator
  });
}
