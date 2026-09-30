import { z } from "zod";
import type {
  VapiRuntimeConfiguration,
  VapiRuntimeDriver,
  VapiRuntimeVerification
} from "./vapi";

const vapiAssistantResponseSchema = z
  .object({
    id: z.string().trim().min(1)
  })
  .passthrough();

const vapiPhoneNumberResponseSchema = z
  .object({
    id: z.string().trim().min(1),
    provider: z.string().trim().min(1),
    credentialId: z.string().trim().min(1).optional()
  })
  .passthrough();

const vapiPhoneNumberListResponseSchema = z.array(vapiPhoneNumberResponseSchema);

export class VapiRuntimeVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VapiRuntimeVerificationError";
  }
}

export type VapiFetch = typeof fetch;

/**
 * Verified Vapi REST readiness driver.
 *
 * Current official Vapi docs verify:
 * - private server API keys use Authorization: Bearer <token>;
 * - GET /assistant/:id retrieves one assistant;
 * - GET /phone-number lists phone-number resources;
 * - BYO phone-number resources expose credentialId.
 *
 * Kros's current Vapi integration guide requires the Kros number to be
 * imported into Vapi as a BYO SIP trunk number using the SIP trunk
 * credential before the Kros Vapi endpoint is created. This driver therefore
 * verifies both the configured Assistant ID and that the configured SIP trunk
 * credential is attached to at least one BYO Vapi phone-number resource.
 *
 * It performs read-only requests only. It does not create assistants,
 * credentials, phone numbers, endpoints or calls.
 */
export class VapiHttpRuntimeDriver implements VapiRuntimeDriver {
  constructor(private readonly fetchImpl: VapiFetch = fetch) {}

  private async getJson(
    configuration: VapiRuntimeConfiguration,
    path: string,
    resourceName: string
  ): Promise<unknown> {
    const response = await this.fetchImpl(
      `${configuration.apiBaseUrl}${path}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${configuration.apiKey}`,
          Accept: "application/json"
        },
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new VapiRuntimeVerificationError(
        `Vapi ${resourceName} verification failed with HTTP ${response.status}`
      );
    }

    return response.json();
  }

  async verifyConfiguration(
    configuration: VapiRuntimeConfiguration
  ): Promise<VapiRuntimeVerification> {
    const assistantPayload = await this.getJson(
      configuration,
      `/assistant/${encodeURIComponent(configuration.assistantId)}`,
      "assistant"
    );
    const assistant = vapiAssistantResponseSchema.parse(assistantPayload);

    if (assistant.id !== configuration.assistantId) {
      throw new VapiRuntimeVerificationError(
        "Vapi assistant verification returned a different assistant ID"
      );
    }

    const phoneNumbersPayload = await this.getJson(
      configuration,
      "/phone-number",
      "phone-number"
    );
    const phoneNumbers = vapiPhoneNumberListResponseSchema.parse(
      phoneNumbersPayload
    );
    const matchingPhoneNumber = phoneNumbers.find(
      (phoneNumber) =>
        phoneNumber.provider === "byo-phone-number" &&
        phoneNumber.credentialId === configuration.sipTrunkCredentialId
    );

    if (!matchingPhoneNumber) {
      throw new VapiRuntimeVerificationError(
        "Configured Vapi SIP trunk credential is not attached to a BYO phone number"
      );
    }

    return {
      assistantId: assistant.id,
      sipTrunkCredentialId: configuration.sipTrunkCredentialId
    };
  }
}
