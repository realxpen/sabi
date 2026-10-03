import type { CommunicationResult } from "../../schemas";

export type ContactProviderInput = {
  missionId: string;
  providerId: string;
  objective: string;
  /** Server-side only. Supplied only for providers whose live-contact consent is persisted. */
  destinationPhone?: string;
};

export interface CommunicationAdapter {
  readonly name: string;

  initiateContact(
    input: ContactProviderInput
  ): Promise<CommunicationResult>;

  normalizeEvent(payload: unknown): Promise<CommunicationResult>;

  /**
   * Optional read-only refresh hook for transports that expose call-log polling.
   * Implementations must not create Quotes or infer factual provider responses.
   */
  refreshCommunication?(
    communication: CommunicationResult
  ): Promise<CommunicationResult>;
}
