import { describe, expect, it } from "vitest";
import {
  VapiHttpRuntimeDriver,
  VapiRuntimeVerificationError
} from "../lib/integrations/voice-runtime/vapi-http-driver";
import { createLiveVapiVoiceRuntime } from "../lib/integrations/voice-runtime/vapi-live";
import type { VapiRuntimeConfiguration } from "../lib/integrations/voice-runtime/vapi";

const configuration: VapiRuntimeConfiguration = {
  apiBaseUrl: "https://api.vapi.ai",
  apiKey: "private-test-key",
  assistantId: "assistant-123",
  sipTrunkCredentialId: "credential-456"
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("VapiHttpRuntimeDriver", () => {
  it("verifies the assistant and a BYO phone number using the configured SIP credential", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchStub = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });

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

    const driver = new VapiHttpRuntimeDriver(fetchStub);
    const verification = await driver.verifyConfiguration(configuration);

    expect(verification).toEqual({
      assistantId: "assistant-123",
      sipTrunkCredentialId: "credential-456"
    });
    expect(calls.map((call) => call.url)).toEqual([
      "https://api.vapi.ai/assistant/assistant-123",
      "https://api.vapi.ai/phone-number"
    ]);
    expect(calls[0].init?.method).toBe("GET");
    expect(calls[0].init?.headers).toEqual({
      Authorization: "Bearer private-test-key",
      Accept: "application/json"
    });
  });

  it("fails verification when Vapi rejects the private API key", async () => {
    const fetchStub = (async () => jsonResponse({ message: "unauthorized" }, 401)) as typeof fetch;
    const driver = new VapiHttpRuntimeDriver(fetchStub);

    await expect(driver.verifyConfiguration(configuration)).rejects.toEqual(
      expect.objectContaining({
        name: "VapiRuntimeVerificationError",
        message: "Vapi assistant verification failed with HTTP 401"
      })
    );
  });

  it("does not treat an unrelated credential or non-BYO number as verified", async () => {
    const fetchStub = (async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/assistant/")) {
        return jsonResponse({ id: "assistant-123" });
      }

      return jsonResponse([
        {
          id: "phone-1",
          provider: "byo-phone-number",
          credentialId: "different-credential"
        },
        {
          id: "phone-2",
          provider: "vapi",
          credentialId: "credential-456"
        }
      ]);
    }) as typeof fetch;

    const driver = new VapiHttpRuntimeDriver(fetchStub);

    await expect(driver.verifyConfiguration(configuration)).rejects.toBeInstanceOf(
      VapiRuntimeVerificationError
    );
  });

  it("creates a live runtime that becomes VERIFIED through the read-only HTTP driver", async () => {
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

    const runtime = createLiveVapiVoiceRuntime(
      {
        VAPI_API_BASE_URL: configuration.apiBaseUrl,
        VAPI_API_KEY: configuration.apiKey,
        VAPI_ASSISTANT_ID: configuration.assistantId,
        VAPI_SIP_TRUNK_CREDENTIAL_ID: configuration.sipTrunkCredentialId
      },
      fetchStub
    );

    const readiness = await runtime.verify();

    expect(readiness.status).toBe("VERIFIED");
    expect(JSON.stringify(readiness)).not.toContain("private-test-key");
  });
});
