import { z } from "zod";
import {
  communicationResultSchema,
  type CommunicationResult,
  type CommunicationStatus,
  type Mission,
  type Provider,
  type Quote
} from "../schemas";
import {
  normalizeCommunicationTranscript,
  type CommunicationTranscriptNormalizationResult
} from "./transcript-normalizer";
import {
  extractQuoteFromCommunication,
  type QuoteExtractionResult
} from "./quote-extraction";
import {
  recommend,
  type RecommendationResult
} from "./recommendation";

const vapiFixtureVariableValuesSchema = z
  .object({
    missionId: z.string().trim().min(1),
    providerId: z.string().trim().min(1),
    communicationId: z.string().trim().min(1),
    objective: z.string().trim().min(1).optional()
  })
  .passthrough();

/**
 * Fixture-only parser for the verified Vapi/Kros end-of-call payload shape used
 * by Lara's adapter. This is intentionally not a replacement for Lara's live
 * webhook verification, deduplication, correlation or transport lifecycle.
 */
const vapiKrosEndOfCallFixtureSchema = z
  .object({
    message: z
      .object({
        type: z.literal("end-of-call-report"),
        timestamp: z.union([z.string(), z.number()]).optional(),
        status: z.string().trim().min(1).optional(),
        endedReason: z.string().trim().min(1).optional(),
        call: z
          .object({
            id: z.string().trim().min(1),
            status: z.string().trim().min(1).optional(),
            endedReason: z.string().trim().min(1).optional(),
            assistantOverrides: z
              .object({
                variableValues: z.record(z.unknown())
              })
              .passthrough()
          })
          .passthrough(),
        artifact: z
          .object({ transcript: z.string().optional() })
          .passthrough()
          .optional(),
        transcript: z.string().optional()
      })
      .passthrough()
  })
  .passthrough();

export type VapiKrosFixturePayload = z.infer<
  typeof vapiKrosEndOfCallFixtureSchema
>;

export type VapiKrosFixtureProjection = {
  communication: CommunicationResult;
  transcript?: string;
};

export type VapiKrosFixtureEventResult = {
  payload: VapiKrosFixturePayload;
  communication: CommunicationResult;
  transcript?: string;
  normalization?: CommunicationTranscriptNormalizationResult;
  normalizedCommunication: CommunicationResult;
  extraction: QuoteExtractionResult;
};

export type VapiKrosIntelligenceFixtureRun = {
  events: VapiKrosFixtureEventResult[];
  quotes: Quote[];
  recommendation: RecommendationResult;
};

function statusForEndedReason(endedReason: string | undefined): CommunicationStatus {
  if (!endedReason) return "COMPLETED";

  if (
    endedReason === "customer-did-not-answer" ||
    endedReason === "customer-busy" ||
    endedReason === "voicemail"
  ) {
    return "NO_ANSWER";
  }

  if (
    endedReason.includes("error-") ||
    endedReason.includes("failed") ||
    endedReason.endsWith("-worker-died") ||
    endedReason === "worker-shutdown" ||
    endedReason === "phone-call-provider-closed-websocket" ||
    endedReason === "phone-call-provider-bypass-enabled-but-no-call-received" ||
    endedReason.startsWith("assistant-not-") ||
    endedReason.startsWith("assistant-request-")
  ) {
    return "FAILED";
  }

  return "COMPLETED";
}

function occurredAt(timestamp: string | number | undefined): string {
  if (typeof timestamp === "string") {
    const parsed = Date.parse(timestamp);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }

  if (typeof timestamp === "number") {
    const milliseconds = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
    const parsed = new Date(milliseconds);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  throw new Error(
    "Vapi/Kros integration fixtures require a valid timestamp for deterministic evidence provenance."
  );
}

/**
 * Projects a verified Lara-shaped end-of-call fixture into the same canonical
 * CommunicationResult shape her adapter returns. It does not authenticate the
 * event and must not be used by production webhook code.
 */
export function projectVerifiedVapiKrosFixture(
  payload: unknown
): VapiKrosFixtureProjection {
  const event = vapiKrosEndOfCallFixtureSchema.parse(payload);
  const variables = vapiFixtureVariableValuesSchema.parse(
    event.message.call.assistantOverrides.variableValues
  );
  const endedReason =
    event.message.endedReason ?? event.message.call.endedReason;
  const status = statusForEndedReason(endedReason);
  const transcript =
    event.message.artifact?.transcript ?? event.message.transcript;
  const transcriptEvidence = Boolean(transcript?.trim());

  return {
    communication: communicationResultSchema.parse({
      id: variables.communicationId,
      missionId: variables.missionId,
      providerId: variables.providerId,
      channel: "CALL",
      status,
      externalId: event.message.call.id,
      summary:
        status === "NO_ANSWER"
          ? `Live provider call ended without reaching the provider (${endedReason ?? "no-answer"}). No Quote evidence was produced.`
          : status === "FAILED"
            ? `Live provider call failed (${endedReason ?? "provider/runtime failure"}). No Quote evidence was produced.`
            : transcriptEvidence
              ? "Verified Vapi call event includes transcript evidence. The transcript is evidence only and has not been converted into a Quote."
              : "Verified Vapi call lifecycle event received. No Quote has been inferred from call status alone.",
      errorCode:
        status === "FAILED"
          ? endedReason ?? "VAPI_CALL_FAILED"
          : status === "NO_ANSWER"
            ? endedReason ?? "VAPI_NO_ANSWER"
            : undefined,
      occurredAt: occurredAt(event.message.timestamp)
    }),
    transcript: transcript?.trim() ? transcript : undefined
  };
}

/**
 * Runs the deterministic intelligence path against verified-shape Vapi/Kros
 * fixtures without placing a real phone call:
 * raw event -> Lara-equivalent CommunicationResult -> transcript observation
 * -> provider-confirmed quantity evidence -> Quote extraction ->
 * constraints/ranking -> recommendation.
 */
export function runVapiKrosIntelligenceFixture(input: {
  mission: Mission;
  providers: Provider[];
  payloads: unknown[];
}): VapiKrosIntelligenceFixtureRun {
  const events = input.payloads.map((payload) => {
    const projected = projectVerifiedVapiKrosFixture(payload);
    const normalization = projected.transcript
      ? normalizeCommunicationTranscript(
          projected.communication,
          projected.transcript,
          { mission: input.mission }
        )
      : undefined;
    const normalizedCommunication =
      normalization?.communication ?? projected.communication;
    const quantityEvidence =
      normalization?.normalization.unrepresentedQuantityEvidence;
    const extraction = extractQuoteFromCommunication(normalizedCommunication, {
      mission: input.mission,
      quoteId: `quote-${normalizedCommunication.id}`,
      createdAt: normalizedCommunication.occurredAt,
      confirmedQuantity:
        quantityEvidence === undefined
          ? undefined
          : {
              quantity: quantityEvidence.quantity,
              unit: quantityEvidence.unit
            }
    });

    return {
      payload: vapiKrosEndOfCallFixtureSchema.parse(payload),
      communication: projected.communication,
      transcript: projected.transcript,
      normalization,
      normalizedCommunication,
      extraction
    };
  });

  const quotes = events.flatMap((event) =>
    event.extraction.quote ? [event.extraction.quote] : []
  );

  return {
    events,
    quotes,
    recommendation: recommend(input.mission, input.providers, quotes)
  };
}

function endOfCallPayload(input: {
  missionId: string;
  providerId: string;
  communicationId: string;
  callId: string;
  timestamp: string;
  transcript?: string;
  transcriptLocation?: "artifact" | "message";
  endedReason?: string;
}): VapiKrosFixturePayload {
  const transcriptLocation = input.transcriptLocation ?? "artifact";

  return vapiKrosEndOfCallFixtureSchema.parse({
    message: {
      type: "end-of-call-report",
      timestamp: input.timestamp,
      endedReason: input.endedReason,
      call: {
        id: input.callId,
        status: "ended",
        endedReason: input.endedReason,
        assistantOverrides: {
          variableValues: {
            missionId: input.missionId,
            providerId: input.providerId,
            communicationId: input.communicationId,
            objective: "Collect factual procurement quote evidence."
          }
        }
      },
      artifact:
        input.transcript && transcriptLocation === "artifact"
          ? { transcript: input.transcript }
          : undefined,
      transcript:
        input.transcript && transcriptLocation === "message"
          ? input.transcript
          : undefined
    }
  });
}

/** Canonical fictional Ankara events using Lara's real Vapi/Kros payload shape. */
export function buildCanonicalAnkaraVapiKrosFixturePayloads(
  missionId: string
): VapiKrosFixturePayload[] {
  return [
    endOfCallPayload({
      missionId,
      providerId: "provider-ade-textiles",
      communicationId: "communication-vapi-ade",
      callId: "vapi-call-ade",
      timestamp: "2026-10-02T08:00:00.000Z",
      transcript: [
        "Assistant: Do you have 20 yards of black Ankara available?",
        "User: Yes, we have 20 yards available.",
        "Assistant: How much would the 20 yards cost?",
        "User: ₦60,000.",
        "Assistant: Can you deliver to Yaba tomorrow?",
        "User: Yes.",
        "Assistant: How much is delivery?",
        "User: ₦3,000."
      ].join("\n")
    }),
    endOfCallPayload({
      missionId,
      providerId: "provider-tola-fabrics",
      communicationId: "communication-vapi-tola",
      callId: "vapi-call-tola",
      timestamp: "2026-10-02T08:05:00.000Z",
      transcriptLocation: "message",
      transcript: [
        "Assistant: Do you have 20 yards of black Ankara available?",
        "User: Yes, we have it.",
        "Assistant: How much would the 20 yards cost?",
        "User: 64k.",
        "Assistant: Can you deliver to Yaba tomorrow?",
        "User: Yes.",
        "Assistant: How much is delivery?",
        "User: 3k."
      ].join("\n")
    }),
    endOfCallPayload({
      missionId,
      providerId: "provider-bola-textiles",
      communicationId: "communication-vapi-bola",
      callId: "vapi-call-bola",
      timestamp: "2026-10-02T08:10:00.000Z",
      transcript: [
        "Assistant: Do you have 20 yards of black Ankara available?",
        "User: Yes, we can supply it.",
        "Assistant: How much would the 20 yards cost?",
        "User: ₦55,000.",
        "Assistant: When can you deliver to Yaba?",
        "User: Friday.",
        "Assistant: How much is delivery?",
        "User: ₦2,000."
      ].join("\n")
    }),
    endOfCallPayload({
      missionId,
      providerId: "provider-sade-fabrics",
      communicationId: "communication-vapi-sade",
      callId: "vapi-call-sade",
      timestamp: "2026-10-02T08:15:00.000Z",
      transcript: [
        "Assistant: Do you have 20 yards of black Ankara available?",
        "User: Yes, it is available.",
        "Assistant: How much would the 20 yards cost?",
        "User: ₦76,000.",
        "Assistant: Can you deliver to Yaba tomorrow?",
        "User: Yes.",
        "Assistant: How much is delivery?",
        "User: ₦3,000."
      ].join("\n")
    }),
    endOfCallPayload({
      missionId,
      providerId: "provider-mariam-fabrics",
      communicationId: "communication-vapi-mariam-no-answer",
      callId: "vapi-call-mariam-no-answer",
      timestamp: "2026-10-02T08:20:00.000Z",
      endedReason: "customer-did-not-answer"
    })
  ];
}
