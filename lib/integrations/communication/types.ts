import type { CommunicationResult } from "../../schemas";

export type ContactProviderInput = {
  missionId: string;
  providerId: string;
  objective: string;
};

export interface CommunicationAdapter {
  readonly name: string;

  initiateContact(
    input: ContactProviderInput
  ): Promise<CommunicationResult>;

  normalizeEvent(payload: unknown): Promise<CommunicationResult>;
}
