import {
  communicationResultSchema,
  type CommunicationResult
} from "../../schemas";
import type {
  CommunicationAdapter,
  ContactProviderInput
} from "./types";

export class MockCommunicationAdapter implements CommunicationAdapter {
  readonly name = "mock";

  async initiateContact(
    input: ContactProviderInput
  ): Promise<CommunicationResult> {
    return communicationResultSchema.parse({
      id: `mock-${input.missionId}-${input.providerId}`,
      missionId: input.missionId,
      providerId: input.providerId,
      channel: "MOCK",
      status: "INITIATED",
      summary: "Mock contact initiated. No real provider was contacted.",
      occurredAt: new Date().toISOString()
    });
  }

  async normalizeEvent(payload: unknown): Promise<CommunicationResult> {
    return communicationResultSchema.parse(payload);
  }
}
