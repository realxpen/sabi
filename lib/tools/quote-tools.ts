import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  communicationResultSchema,
  quoteSchema,
  quoteSourceSchema,
  type CommunicationResult,
  type Quote,
  type QuoteSource
} from "../schemas";
import { getProvider } from "./provider-tools";

function isUnresolvedBimpePlaceholder(value: string): boolean {
  return /^\{\{[^{}]+\}\}$/.test(value.trim());
}

const bimpeBooleanSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return value;
}, z.boolean());

const optionalBimpeNumberSchema = z.preprocess((value) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "string") {
    const normalized = value.trim();

    if (!normalized || isUnresolvedBimpePlaceholder(normalized)) {
      return undefined;
    }

    return Number(normalized);
  }

  return value;
}, z.number().nonnegative().optional());

const optionalBimpePositiveNumberSchema = z.preprocess((value) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "string") {
    const normalized = value.trim();

    if (!normalized || isUnresolvedBimpePlaceholder(normalized)) {
      return undefined;
    }

    return Number(normalized);
  }

  return value;
}, z.number().positive().optional());

const optionalBimpeStringSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.trim();

    if (!normalized || isUnresolvedBimpePlaceholder(normalized)) {
      return undefined;
    }
  }

  return value;
}, z.string().trim().min(1).optional());

export const recordQuoteInputSchema = z.object({
  missionId: z.string().trim().min(1),
  providerId: z.string().trim().min(1),
  available: bimpeBooleanSchema,
  quantity: optionalBimpePositiveNumberSchema,
  unit: optionalBimpeStringSchema,
  price: optionalBimpeNumberSchema,
  deliveryFee: optionalBimpeNumberSchema,
  total: optionalBimpeNumberSchema,
  deliveryDate: optionalBimpeStringSchema,
  notes: optionalBimpeStringSchema,
  source: quoteSourceSchema,
  sourceReference: optionalBimpeStringSchema
});

export type RecordQuoteInput = z.infer<typeof recordQuoteInputSchema>;

/**
 * Build a canonical Quote from factual provider evidence.
 *
 * quantity/unit represent the provider-confirmed or explicitly quoted amount,
 * not a copy of the Mission request. This tool validates and normalizes Quote
 * data only. It does not persist to a database, mutate Mission state, calculate
 * missing totals, or assume a missing delivery fee is zero.
 */
export function recordQuote(input: RecordQuoteInput): Quote {
  const quoteInput = recordQuoteInputSchema.parse(input);
  const provider = getProvider(quoteInput.providerId);

  if (!provider) {
    throw new Error(`Provider not found: ${quoteInput.providerId}`);
  }

  return quoteSchema.parse({
    id: `quote-${randomUUID()}`,
    ...quoteInput,
    createdAt: new Date().toISOString()
  });
}

function quoteSourceForCommunication(
  communication: CommunicationResult
): QuoteSource {
  if (communication.channel === "CALL") {
    return "CALL";
  }

  if (communication.channel === "SMS") {
    return "SMS";
  }

  return "OTHER";
}

/**
 * Create a Quote only when a completed CommunicationResult contains explicit
 * availability evidence. A completed call/message by itself is not a Quote.
 *
 * NO_ANSWER, UNAVAILABLE, FAILED, INITIATED and IN_PROGRESS results never
 * produce Quotes here. Missing commercial values remain unknown; this helper
 * intentionally does not calculate a total or assume a delivery fee. Exact
 * quantity evidence from transcripts is carried by the intelligence extraction
 * seam because CommunicationObservation does not claim quantity by itself.
 */
export function recordQuoteFromCommunication(
  candidate: CommunicationResult
): Quote | undefined {
  const communication = communicationResultSchema.parse(candidate);

  if (communication.status !== "COMPLETED") {
    return undefined;
  }

  if (communication.observation?.available === undefined) {
    return undefined;
  }

  return recordQuote({
    missionId: communication.missionId,
    providerId: communication.providerId,
    available: communication.observation.available,
    price: communication.observation.price,
    deliveryFee: communication.observation.deliveryFee,
    deliveryDate: communication.observation.deliveryDate,
    notes: communication.observation.notes,
    source: quoteSourceForCommunication(communication),
    sourceReference: communication.externalId ?? communication.id
  });
}
