import { z } from "zod";
import type {
  VoiceRuntime,
  VoiceRuntimeReadiness
} from "./types";

const requiredVapiConfigurationKeys = [
  "VAPI_API_BASE_URL",
  "VAPI_API_KEY",
  "VAPI_ASSISTANT_ID",
  "VAPI_SIP_TRUNK_CREDENTIAL_ID"
] as const;

export const vapiApiBaseUrlSchema = z.enum([
  "https://api.vapi.ai",
  "https://api.eu.vapi.ai"
]);

export const vapiRuntimeConfigurationSchema = z.object({
  apiBaseUrl: vapiApiBaseUrlSchema,
  apiKey: z.string().trim().min(1),
  assistantId: z.string().trim().min(1),
  sipTrunkCredentialId: z.string().trim().min(1)
});

export type VapiRuntimeConfiguration = z.infer<
  typeof vapiRuntimeConfigurationSchema
>;

export type VapiRuntimeEnvironment = {
  [key: string]: string | undefined;
};

export type VapiRuntimeVerification = {
  assistantId: string;
  sipTrunkCredentialId: string;
};

/**
 * Provider-specific live verification seam.
 *
 * A real implementation must use current verified Vapi account/docs evidence.
 * The current HTTP driver lives in vapi-http-driver.ts and performs read-only
 * checks against documented Vapi endpoints.
 */
export interface VapiRuntimeDriver {
  verifyConfiguration(
    configuration: VapiRuntimeConfiguration
  ): Promise<VapiRuntimeVerification>;
}

export class VapiRuntimeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VapiRuntimeConfigurationError";
  }
}

export function readVapiRuntimeConfiguration(
  environment: VapiRuntimeEnvironment = process.env
): VapiRuntimeConfiguration | undefined {
  const candidate = {
    apiBaseUrl: environment.VAPI_API_BASE_URL,
    apiKey: environment.VAPI_API_KEY,
    assistantId: environment.VAPI_ASSISTANT_ID,
    sipTrunkCredentialId: environment.VAPI_SIP_TRUNK_CREDENTIAL_ID
  };
  const parsed = vapiRuntimeConfigurationSchema.safeParse(candidate);

  return parsed.success ? parsed.data : undefined;
}

function missingVapiConfiguration(
  environment: VapiRuntimeEnvironment
): string[] {
  return requiredVapiConfigurationKeys.filter(
    (key) => !environment[key]?.trim()
  );
}

/**
 * Vapi voice-runtime readiness seam.
 *
 * SABI only reports VERIFIED after an injected driver confirms the configured
 * account artifacts using live/read-only provider checks. The private API key
 * never appears in readiness output.
 */
export class VapiVoiceRuntime implements VoiceRuntime {
  readonly name = "vapi";

  private verifiedAt?: string;

  constructor(
    private readonly environment: VapiRuntimeEnvironment = process.env,
    private readonly driver?: VapiRuntimeDriver
  ) {}

  getReadiness(): VoiceRuntimeReadiness {
    const missingConfiguration = missingVapiConfiguration(this.environment);
    const configuration = readVapiRuntimeConfiguration(this.environment);

    if (!configuration) {
      return {
        provider: this.name,
        status: "UNCONFIGURED",
        missingConfiguration
      };
    }

    return {
      provider: this.name,
      status: this.verifiedAt ? "VERIFIED" : "CONFIGURED_UNVERIFIED",
      assistantReference: configuration.assistantId,
      transportCredentialReference: configuration.sipTrunkCredentialId,
      missingConfiguration: [],
      checkedAt: this.verifiedAt
    };
  }

  async verify(): Promise<VoiceRuntimeReadiness> {
    const configuration = readVapiRuntimeConfiguration(this.environment);

    if (!configuration) {
      const missing = missingVapiConfiguration(this.environment);
      throw new VapiRuntimeConfigurationError(
        `Vapi runtime is missing required configuration: ${missing.join(", ")}`
      );
    }

    if (!this.driver) {
      throw new VapiRuntimeConfigurationError(
        "Vapi runtime is configured but has no verified live driver. Use the documented read-only Vapi HTTP driver or inject another verified driver."
      );
    }

    const verification = await this.driver.verifyConfiguration(configuration);

    if (
      verification.assistantId !== configuration.assistantId ||
      verification.sipTrunkCredentialId !== configuration.sipTrunkCredentialId
    ) {
      throw new Error("Vapi runtime verification returned mismatched account artifacts");
    }

    this.verifiedAt = new Date().toISOString();
    return this.getReadiness();
  }
}
