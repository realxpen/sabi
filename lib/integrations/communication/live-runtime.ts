import type { CommunicationResult } from "../../schemas";
import { getRegisteredProviderPhone } from "../neon/provider-registry";
import type {
  CommunicationAdapter,
  ContactProviderInput
} from "./types";
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

class RegistryBackedVapiKrosCommunicationAdapter implements CommunicationAdapter {
  readonly name = "vapi-kros";

  constructor(
    private readonly environment: CommunicationEnvironment,
    private readonly fetchImpl: VapiKrosFetch
  ) {}

  async initiateContact(input: ContactProviderInput): Promise<CommunicationResult> {
    const registeredPhone =
      input.destinationPhone ?? (await getRegisteredProviderPhone(input.providerId));

    const scopedEnvironment: CommunicationEnvironment = registeredPhone
      ? {
          ...this.environment,
          SABI_CONSENTED_PROVIDER_PHONES_JSON: JSON.stringify({
            [input.providerId]: registeredPhone
          })
        }
      : this.environment;

    return new VapiKrosCommunicationAdapter(
      scopedEnvironment,
      this.fetchImpl
    ).initiateContact(input);
  }

  async normalizeEvent(payload: unknown): Promise<CommunicationResult> {
    return new VapiKrosCommunicationAdapter(
      this.environment,
      this.fetchImpl
    ).normalizeEvent(payload);
  }

  async refreshCommunication(
    communication: CommunicationResult
  ): Promise<CommunicationResult> {
    return new VapiKrosCommunicationAdapter(
      this.environment,
      this.fetchImpl
    ).refreshCommunication(communication);
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
    return new RegistryBackedVapiKrosCommunicationAdapter(environment, fetchImpl);
  }
  return new InvalidCommunicationModeAdapter(mode);
}
