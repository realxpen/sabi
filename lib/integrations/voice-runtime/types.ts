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

export interface VoiceRuntime {
  readonly name: string;

  getReadiness(): VoiceRuntimeReadiness;
  verify(): Promise<VoiceRuntimeReadiness>;
}
