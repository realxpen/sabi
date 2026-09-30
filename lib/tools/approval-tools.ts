import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  approvalSchema,
  quoteSchema,
  type Approval,
  type Quote
} from "../schemas";
import { getProvider } from "./provider-tools";

export const requestApprovalInputSchema = z.object({
  missionId: z.string().trim().min(1),
  quoteId: z.string().trim().min(1),
  providerId: z.string().trim().min(1)
});

export type RequestApprovalInput = z.infer<typeof requestApprovalInputSchema>;

export type QuoteLookup = (quoteId: string) => Quote | undefined;

/**
 * Create a pending human approval for selecting a provider Quote.
 *
 * The Quote lookup is injected because the current repository has no
 * persistence/repository boundary for Quotes. The tool verifies that the
 * Quote exists and belongs to the same mission/provider before creating the
 * Approval. It does not purchase, book, transfer funds, or mutate Mission.
 */
export function requestApproval(
  input: RequestApprovalInput,
  lookupQuote: QuoteLookup
): Approval {
  const approvalInput = requestApprovalInputSchema.parse(input);
  const provider = getProvider(approvalInput.providerId);

  if (!provider) {
    throw new Error(`Provider not found: ${approvalInput.providerId}`);
  }

  const quoteCandidate = lookupQuote(approvalInput.quoteId);

  if (!quoteCandidate) {
    throw new Error(`Quote not found: ${approvalInput.quoteId}`);
  }

  const quote = quoteSchema.parse(quoteCandidate);

  if (quote.missionId !== approvalInput.missionId) {
    throw new Error("Quote does not belong to the requested mission");
  }

  if (quote.providerId !== approvalInput.providerId) {
    throw new Error("Quote does not belong to the requested provider");
  }

  return approvalSchema.parse({
    id: `approval-${randomUUID()}`,
    missionId: approvalInput.missionId,
    action: "SELECT_PROVIDER",
    providerId: approvalInput.providerId,
    quoteId: approvalInput.quoteId,
    status: "PENDING",
    createdAt: new Date().toISOString()
  });
}
