import { randomUUID } from "node:crypto";
import {
  communicationResultSchema,
  type CommunicationChannel,
  type CommunicationResult
} from "../../schemas";
import type {
  CommunicationAdapter,
  ContactProviderInput
} from "./types";

export type InitiateContactWithRecoveryInput = {
  contact: ContactProviderInput;
  adapter: CommunicationAdapter;
  failureChannel?: CommunicationChannel;
};

/**
 * Convert transport/provider initiation failures into a canonical FAILED
 * CommunicationResult without leaking provider errors or inventing evidence.
 *
 * This does not retry, mutate Mission, select another provider, or create a
 * Quote. Any fallback remains an explicit higher-level decision.
 */
export async function initiateContactWithRecovery(
  input: InitiateContactWithRecoveryInput
): Promise<CommunicationResult> {
  try {
    return communicationResultSchema.parse(
      await input.adapter.initiateContact(input.contact)
    );
  } catch {
    return communicationResultSchema.parse({
      id: `communication-failed-${randomUUID()}`,
      missionId: input.contact.missionId,
      providerId: input.contact.providerId,
      channel: input.failureChannel ?? "OTHER",
      status: "FAILED",
      summary:
        "Provider communication failed before a valid result was returned. No Quote evidence was produced.",
      errorCode: "COMMUNICATION_INITIATION_FAILED",
      occurredAt: new Date().toISOString()
    });
  }
}
