import { afterEach, describe, expect, it } from "vitest";
import { GET } from "../app/api/internal/runtime-status/route";

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnvironment)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, originalEnvironment);
});

describe("Preview runtime status", () => {
  it("is hidden outside Preview", async () => {
    process.env.VERCEL_ENV = "production";

    const response = await GET();

    expect(response.status).toBe(404);
  });

  it("reports Vapi, L8 and L9 readiness without exposing secrets or phone numbers", async () => {
    process.env.VERCEL_ENV = "preview";
    delete process.env.DATABASE_URL;
    process.env.SABI_AGENT_TOOL_TOKEN = "private-agent-token";

    process.env.SABI_COMMUNICATION_MODE = "mock";
    process.env.VAPI_API_BASE_URL = "https://api.vapi.ai";
    process.env.VAPI_API_KEY = "private-vapi-key";
    process.env.VAPI_ASSISTANT_ID = "assistant-test";
    process.env.VAPI_SIP_TRUNK_CREDENTIAL_ID = "credential-test";
    process.env.VAPI_WEBHOOK_TOKEN = "private-webhook-token";
    process.env.SABI_CONSENTED_PROVIDER_PHONES_JSON = JSON.stringify({
      "provider-tola-fabrics": "+2348012345678"
    });

    process.env.SABI_AFRICAN_VOICE_MODE = "livekit-spitch";
    process.env.SPITCH_API_KEY = "private-spitch-key";
    process.env.LIVEKIT_URL = "wss://private.livekit.cloud";
    process.env.LIVEKIT_API_KEY = "private-livekit-key";
    process.env.LIVEKIT_API_SECRET = "private-livekit-secret";
    process.env.LIVEKIT_AGENT_NAME = "sabi-african-voice";
    process.env.LIVEKIT_SIP_TRUNK_ID = "private-trunk-id";

    process.env.SABI_MESSAGE_MODE = "voicebip-temlio";
    process.env.VOICEBIP_API_KEY = "pk_test_private";
    process.env.VOICEBIP_AGENT_ID = "agt_private";
    process.env.VOICEBIP_SMS_FROM_NUMBER = "+2348000001000";
    process.env.VOICEBIP_WEBHOOK_SIGNING_SECRET = "private-signing-secret";
    process.env.SABI_CONSENTED_PROVIDER_MESSAGE_PHONES_JSON =
      JSON.stringify({
        "provider-tola-fabrics": "+2348000002000"
      });

    const response = await GET();
    const text = await response.text();
    const payload = JSON.parse(text);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      environment: "preview",
      agentToolAuthConfigured: true,
      communicationMode: "mock",
      vapi: {
        apiBaseConfigured: true,
        apiKeyConfigured: true,
        assistantConfigured: true,
        sipTrunkConfigured: true,
        webhookAuthConfigured: true,
        configured: true
      },
      consentedProviderPhoneCount: 1,
      liveCommunicationReady: false,
      africanVoice: {
        mode: "livekit-spitch",
        spitchApiKeyConfigured: true,
        livekitUrlConfigured: true,
        livekitApiKeyConfigured: true,
        livekitApiSecretConfigured: true,
        livekitAgentConfigured: true,
        livekitSipTrunkConfigured: true,
        configured: true,
        readyForExternalAgentProof: true
      },
      messaging: {
        mode: "voicebip-temlio",
        voicebipApiKeyConfigured: true,
        voicebipAgentConfigured: true,
        voicebipFromNumberConfigured: true,
        webhookAuthConfigured: true,
        correlationTableReady: false,
        consentedProviderPhoneCount: 1,
        configured: true,
        liveReady: false
      }
    });

    for (const secret of [
      "private-agent-token",
      "private-vapi-key",
      "private-webhook-token",
      "private-spitch-key",
      "wss://private.livekit.cloud",
      "private-livekit-key",
      "private-livekit-secret",
      "private-trunk-id",
      "pk_test_private",
      "agt_private",
      "private-signing-secret",
      "+2348012345678",
      "+2348000001000",
      "+2348000002000"
    ]) {
      expect(text).not.toContain(secret);
    }
  });

  it("treats malformed consent configuration as zero destinations", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.SABI_CONSENTED_PROVIDER_PHONES_JSON = "not-json";
    process.env.SABI_CONSENTED_PROVIDER_MESSAGE_PHONES_JSON = "not-json";

    const response = await GET();
    const payload = await response.json();

    expect(payload.consentedProviderPhoneCount).toBe(0);
    expect(payload.liveCommunicationReady).toBe(false);
    expect(payload.messaging.consentedProviderPhoneCount).toBe(0);
    expect(payload.messaging.liveReady).toBe(false);
  });
});
