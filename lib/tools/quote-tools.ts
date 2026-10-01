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
 * This tool validates and normalizes Quote data only. It does not persist to
 * a database, mutate Mission state, calculate missing totals, or assume a
 * missing delivery fee is zero. Persistence can be added later behind an
 * explicit repository boundary when one exists in the SABI architecture.
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
 * intentionally does not calculate a total or assume a delivery fee.
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
