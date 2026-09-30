export type VoiceRuntimeReadinessStatus =
  | "UNCONFIGURED"
  | "CONFIGURED_UNVERIFIED"
  | "VERIFIED";

export type VoiceRuntimeReadiness = {
  provider: string;
  status: VoiceRuntimeReadinessStatus;
  assistantReference?: string;
  transportCredentialReference?: string;
  missingConfiguration: string[];
  checkedAt?: string;
};

/**
 * Small provider-neutral readiness boundary for external voice runtimes.
 *
 * SABI remains the system of record for Mission/CommunicationResult/Quote.
 * Voice runtimes only report whether their account artifacts have been
 * configured and, when a verified provider driver exists, whether those
 * artifacts have been checked successfully.
 */
export interface VoiceRuntime {
  readonly name: string;

  getReadiness(): VoiceRuntimeReadiness;
  verify(): Promise<VoiceRuntimeReadiness>;
}
