import { describe, expect, it } from "vitest";
import { probeVapiReadiness } from "../lib/integrations/voice-runtime/vapi-readiness";
import type { VapiRuntimeEnvironment } from "../lib/integrations/voice-runtime/vapi";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

const configuredEnvironment: VapiRuntimeEnvironment = {
  SABI_COMMUNICATION_MODE: "vapi-kros",
  VAPI_API_BASE_URL: "https://api.vapi.ai",
  VAPI_API_KEY: "private-test-key",
  VAPI_ASSISTANT_ID: "assistant-123",
  VAPI_SIP_TRUNK_CREDENTIAL_ID: "credential-456",
  VAPI_WEBHOOK_TOKEN: "webhook-test-secret"
};

describe("probeVapiReadiness", () => {
  it("reports unconfigured without making a provider request", async () => {
    let fetchCalled = false;
    const fetchStub = (async () => {
      fetchCalled = true;
      return jsonResponse({});
    }) as typeof fetch;

    const result = await probeVapiReadiness(
      { SABI_COMMUNICATION_MODE: "vapi-kros" },
      fetchStub
    );

    expect(fetchCalled).toBe(false);
    expect(result.status).toBe("UNCONFIGURED");
    expect(result.ready).toBe(false);
    expect(result.missingConfiguration).toEqual([
      "VAPI_API_BASE_URL",
      "VAPI_API_KEY",
      "VAPI_ASSISTANT_ID",
      "VAPI_SIP_TRUNK_CREDENTIAL_ID"
    ]);
  });

  it("verifies the assistant and BYO SIP linkage without exposing secrets or provider IDs", async () => {
    const requests: string[] = [];
    const fetchStub = (async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);

      if (url.endsWith("/assistant/assistant-123")) {
        return jsonResponse({ id: "assistant-123", orgId: "org-test" });
      }

      if (url.endsWith("/phone-number")) {
        return jsonResponse([
          {
            id: "phone-1",
            provider: "byo-phone-number",
            credentialId: "credential-456"
          }
        ]);
      }

      return jsonResponse({}, 404);
    }) as typeof fetch;

    const result = await probeVapiReadiness(
      configuredEnvironment,
      fetchStub
    );

    expect(requests).toEqual([
      "https://api.vapi.ai/assistant/assistant-123",
      "https://api.vapi.ai/phone-number"
    ]);
    expect(result).toEqual(
      expect.objectContaining({
        provider: "vapi",
        status: "VERIFIED",
        missingConfiguration: [],
        communicationMode: "vapi-kros",
        webhookAuthConfigured: true,
        ready: true,
        checkedAt: expect.any(String)
      })
    );

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("private-test-key");
    expect(serialized).not.toContain("assistant-123");
    expect(serialized).not.toContain("credential-456");
    expect(serialized).not.toContain("webhook-test-secret");
    expect(serialized).not.toContain("phone-1");
  });

  it("returns a sanitized failure when Vapi rejects verification", async () => {
    const fetchStub = (async () =>
      jsonResponse({ message: "unauthorized" }, 401)) as typeof fetch;

    const result = await probeVapiReadiness(
      configuredEnvironment,
      fetchStub
    );

    expect(result).toEqual({
      provider: "vapi",
      status: "VERIFICATION_FAILED",
      missingConfiguration: [],
      communicationMode: "vapi-kros",
      webhookAuthConfigured: true,
      ready: false
    });
    expect(JSON.stringify(result)).not.toContain("unauthorized");
  });

  it("keeps readiness false when provider artifacts verify but the webhook boundary is not enabled", async () => {
    const fetchStub = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/assistant/")) {
        return jsonResponse({ id: "assistant-123" });
      }

      return jsonResponse([
        {
          id: "phone-1",
          provider: "byo-phone-number",
          credentialId: "credential-456"
        }
      ]);
    }) as typeof fetch;

    const result = await probeVapiReadiness(
      {
        ...configuredEnvironment,
        SABI_COMMUNICATION_MODE: "mock",
        VAPI_WEBHOOK_TOKEN: undefined
      },
      fetchStub
    );

    expect(result.status).toBe("VERIFIED");
    expect(result.webhookAuthConfigured).toBe(false);
    expect(result.communicationMode).toBe("mock");
    expect(result.ready).toBe(false);
  });
});
