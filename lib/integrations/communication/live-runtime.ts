import type { CommunicationAdapter } from "./types";
import { MockCommunicationAdapter } from "./mock";
import {
  BimpeAICommunicationAdapter,
  type BimpeAIEnvironment
} from "./bimpe-ai";
import {
  VapiKrosCommunicationAdapter,
  type VapiKrosEnvironment,
  type VapiKrosFetch
} from "./vapi-kros";

export const communicationModeValues = ["mock", "bimpe", "vapi-kros"] as const;
export type CommunicationMode = (typeof communicationModeValues)[number];

type CommunicationEnvironment = VapiKrosEnvironment & BimpeAIEnvironment;

class InvalidCommunicationModeAdapter implements CommunicationAdapter {
  readonly name = "invalid-communication-mode";

  constructor(private readonly configuredMode: string) {}

  async initiateContact(): Promise<never> {
    throw new Error(`Unsupported SABI_COMMUNICATION_MODE: ${this.configuredMode}`);
  }

  async normalizeEvent(): Promise<never> {
    throw new Error(`Unsupported SABI_COMMUNICATION_MODE: ${this.configuredMode}`);
  }
}

export function createConfiguredCommunicationAdapter(
  environment: CommunicationEnvironment = process.env,
  fetchImpl: VapiKrosFetch = fetch
): CommunicationAdapter {
  const mode = environment.SABI_COMMUNICATION_MODE?.trim() || "mock";

  if (mode === "mock") return new MockCommunicationAdapter();
  if (mode === "bimpe") {
    return new BimpeAICommunicationAdapter(environment, fetchImpl);
  }
  if (mode === "vapi-kros") {
    return new VapiKrosCommunicationAdapter(environment, fetchImpl);
  }
  return new InvalidCommunicationModeAdapter(mode);
}
