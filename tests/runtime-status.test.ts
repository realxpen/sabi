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

  it("reports Vapi readiness booleans without exposing secrets or phone numbers", async () => {
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
      liveCommunicationReady: false
    });
    expect(text).not.toContain("private-agent-token");
    expect(text).not.toContain("private-vapi-key");
    expect(text).not.toContain("private-webhook-token");
    expect(text).not.toContain("+2348012345678");
  });

  it("treats malformed consent configuration as zero callable destinations", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.SABI_CONSENTED_PROVIDER_PHONES_JSON = "not-json";

    const response = await GET();
    const payload = await response.json();

    expect(payload.consentedProviderPhoneCount).toBe(0);
    expect(payload.liveCommunicationReady).toBe(false);
  });
});
