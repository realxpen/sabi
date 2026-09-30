import { describe, expect, it } from "vitest";
import {
  VapiRuntimeConfigurationError,
  VapiVoiceRuntime,
  readVapiRuntimeConfiguration
} from "../lib/integrations/voice-runtime/vapi";

const completeEnvironment = {
  VAPI_API_KEY: "test-secret-key",
  VAPI_ASSISTANT_ID: "assistant-test-123",
  VAPI_SIP_TRUNK_CREDENTIAL_ID: "sip-credential-test-456"
};

describe("VapiVoiceRuntime", () => {
  it("reports exactly which required account artifacts are missing", () => {
    const runtime = new VapiVoiceRuntime({
      VAPI_ASSISTANT_ID: "assistant-test-123"
    });

    expect(runtime.getReadiness()).toEqual({
      provider: "vapi",
      status: "UNCONFIGURED",
      missingConfiguration: [
        "VAPI_API_KEY",
        "VAPI_SIP_TRUNK_CREDENTIAL_ID"
      ]
    });
  });

  it("reports configured-but-unverified without exposing the API key", () => {
    const runtime = new VapiVoiceRuntime(completeEnvironment);
    const readiness = runtime.getReadiness();

    expect(readiness.status).toBe("CONFIGURED_UNVERIFIED");
    expect(readiness.assistantReference).toBe("assistant-test-123");
    expect(readiness.transportCredentialReference).toBe(
      "sip-credential-test-456"
    );
    expect(JSON.stringify(readiness)).not.toContain("test-secret-key");
  });

  it("fails closed when configuration exists but no verified driver is supplied", async () => {
    const runtime = new VapiVoiceRuntime(completeEnvironment);

    await expect(runtime.verify()).rejects.toBeInstanceOf(
      VapiRuntimeConfigurationError
    );
    expect(runtime.getReadiness().status).toBe("CONFIGURED_UNVERIFIED");
  });

  it("becomes VERIFIED only after an injected driver confirms the same account artifacts", async () => {
    const runtime = new VapiVoiceRuntime(completeEnvironment, {
      async verifyConfiguration(configuration) {
        expect(configuration.apiKey).toBe("test-secret-key");
        return {
          assistantId: configuration.assistantId,
          sipTrunkCredentialId: configuration.sipTrunkCredentialId
        };
      }
    });

    const readiness = await runtime.verify();

    expect(readiness.status).toBe("VERIFIED");
    expect(readiness.checkedAt).toBeDefined();
    expect(JSON.stringify(readiness)).not.toContain("test-secret-key");
  });

  it("rejects verification results for different Vapi account artifacts", async () => {
    const runtime = new VapiVoiceRuntime(completeEnvironment, {
      async verifyConfiguration() {
        return {
          assistantId: "different-assistant",
          sipTrunkCredentialId: "sip-credential-test-456"
        };
      }
    });

    await expect(runtime.verify()).rejects.toThrow(
      "mismatched account artifacts"
    );
    expect(runtime.getReadiness().status).toBe("CONFIGURED_UNVERIFIED");
  });

  it("parses complete environment configuration without changing values", () => {
    expect(readVapiRuntimeConfiguration(completeEnvironment)).toEqual({
      apiKey: "test-secret-key",
      assistantId: "assistant-test-123",
      sipTrunkCredentialId: "sip-credential-test-456"
    });
  });
});
