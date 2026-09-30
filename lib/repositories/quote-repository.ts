import { quoteSchema, type Quote } from "../schemas";

export interface QuoteRepository {
  save(quote: Quote): Promise<Quote>;
  getById(quoteId: string): Promise<Quote | undefined>;
}

/**
 * Shared repository validation helpers keep persistence implementations from
 * returning raw storage rows directly into SABI domain logic.
 */
export function validateStoredQuote(candidate: unknown): Quote {
  return quoteSchema.parse(candidate);
}
