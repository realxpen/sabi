import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  quoteSchema,
  quoteSourceSchema,
  type Quote
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
