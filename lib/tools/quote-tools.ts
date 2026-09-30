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

export const recordQuoteInputSchema = z.object({
  missionId: z.string().trim().min(1),
  providerId: z.string().trim().min(1),
  available: z.boolean(),
  price: z.number().nonnegative().optional(),
  deliveryFee: z.number().nonnegative().optional(),
  total: z.number().nonnegative().optional(),
  deliveryDate: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
  source: quoteSourceSchema,
  sourceReference: z.string().trim().min(1).optional()
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
