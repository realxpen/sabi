import { z } from "zod";
import type {
  VoiceRuntime,
  VoiceRuntimeReadiness
} from "./types";

const requiredVapiConfigurationKeys = [
  "VAPI_API_KEY",
  "VAPI_ASSISTANT_ID",
  "VAPI_SIP_TRUNK_CREDENTIAL_ID"
] as const;

export const vapiRuntimeConfigurationSchema = z.object({
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
 * The repository does not currently contain a verified Vapi live request
 * schema. A real implementation of this driver must come from current Vapi
 * account/docs evidence and must not be guessed from memory.
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
 * This class deliberately does not make Vapi HTTP calls, provision SIP, or
 * create assistants. It validates that real account artifacts have been
 * supplied and only performs live verification through an injected verified
 * driver. API keys never appear in readiness output.
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
        "Vapi runtime is configured but has no verified live driver. Confirm current Vapi account/API behavior before enabling live verification."
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
