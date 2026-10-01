import {
  spitchSupportedLanguages,
  type SpitchEnvironment
} from "./spitch";

export const africanVoiceModeValues = ["disabled", "livekit-spitch"] as const;
export type AfricanVoiceMode = (typeof africanVoiceModeValues)[number];

export type LiveKitSpitchEnvironment = SpitchEnvironment & {
  [key: string]: string | undefined;
};

function configured(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

export function getLiveKitSpitchReadiness(
  environment: LiveKitSpitchEnvironment = process.env
) {
  const mode =
    environment.SABI_AFRICAN_VOICE_MODE?.trim() || "disabled";
  const modeValid = africanVoiceModeValues.some(
    (candidate) => candidate === mode
  );

  const config = {
    livekitUrlConfigured: configured(environment.LIVEKIT_URL),
    livekitApiKeyConfigured: configured(environment.LIVEKIT_API_KEY),
    livekitApiSecretConfigured: configured(environment.LIVEKIT_API_SECRET),
    livekitAgentNameConfigured: configured(environment.LIVEKIT_AGENT_NAME),
    livekitSipTrunkConfigured: configured(environment.LIVEKIT_SIP_TRUNK_ID),
    spitchApiKeyConfigured: configured(environment.SPITCH_API_KEY)
  };

  const configuredForExternalAgent = Boolean(
    config.livekitUrlConfigured &&
      config.livekitApiKeyConfigured &&
      config.livekitApiSecretConfigured &&
      config.livekitAgentNameConfigured &&
      config.livekitSipTrunkConfigured &&
      config.spitchApiKeyConfigured
  );

  return {
    mode,
    modeValid,
    enabled: mode === "livekit-spitch",
    configured: configuredForExternalAgent,
    readyForExternalAgentProof: Boolean(
      mode === "livekit-spitch" && configuredForExternalAgent
    ),
    requiresExternalAgentRuntime: true,
    supportedLanguages: [...spitchSupportedLanguages],
    config
  };
}
