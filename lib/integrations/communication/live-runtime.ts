import type { CommunicationAdapter } from "./types";
import { MockCommunicationAdapter } from "./mock";
import {
  VapiKrosCommunicationAdapter,
  type VapiKrosEnvironment,
  type VapiKrosFetch
} from "./vapi-kros";

export const communicationModeValues = ["mock", "vapi-kros"] as const;
export type CommunicationMode = (typeof communicationModeValues)[number];

class InvalidCommunicationModeAdapter implements CommunicationAdapter {
  readonly name = "invalid-communication-mode";

  constructor(private readonly configuredMode: string) {}

  async initiateContact(): Promise<never> {
    throw new Error(
      `Unsupported SABI_COMMUNICATION_MODE: ${this.configuredMode}`
    );
  }

  async normalizeEvent(): Promise<never> {
    throw new Error(
      `Unsupported SABI_COMMUNICATION_MODE: ${this.configuredMode}`
    );
  }
}

/**
 * Resolve the communication adapter used by bounded SABI tools.
 *
 * Live calling is opt-in. Missing SABI_COMMUNICATION_MODE defaults to mock so
 * deploying credentials alone cannot silently turn demo calls into real calls.
 */
export function createConfiguredCommunicationAdapter(
  environment: VapiKrosEnvironment = process.env,
  fetchImpl: VapiKrosFetch = fetch
): CommunicationAdapter {
  const mode = environment.SABI_COMMUNICATION_MODE?.trim() || "mock";

  if (mode === "mock") {
    return new MockCommunicationAdapter();
  }

  if (mode === "vapi-kros") {
    return new VapiKrosCommunicationAdapter(environment, fetchImpl);
  }

  return new InvalidCommunicationModeAdapter(mode);
}
