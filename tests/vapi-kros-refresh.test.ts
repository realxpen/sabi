import { describe, expect, it, vi } from "vitest";
import { communicationResultSchema } from "../lib/schemas";
import { VapiKrosCommunicationAdapter } from "../lib/integrations/communication/vapi-kros";

const environment = {
  VAPI_API_BASE_URL: "https://api.vapi.ai",
  VAPI_API_KEY: "private-test-key",
  VAPI_ASSISTANT_ID: "assistant-sabi",
  VAPI_SIP_TRUNK_CREDENTIAL_ID: "credential-kros"
};

function persistedCommunication() {
  return communicationResultSchema.parse({
    id: "communication-refresh",
    missionId: "mission-refresh",
    providerId: "provider-refresh",
    channel: "CALL",
    status: "INITIATED",
    externalId: "call-refresh-123",
    occurredAt: "2026-10-03T00:20:43.077Z"
  });
}

describe("Vapi/Kros communication refresh", () => {
  it("polls the persisted Vapi call and maps in-progress status without starting a new call", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("https://api.vapi.ai/call/call-refresh-123");
      expect(init?.method).toBe("GET");
      expect(new Headers(init?.headers).get("authorization")).toBe(
        "Bearer private-test-key"
      );

      return Response.json({
        id: "call-refresh-123",
        assistantId: "assistant-sabi",
        status: "in-progress",
        updatedAt: "2026-10-03T00:21:30.000Z"
      });
    }) as typeof fetch;

    const adapter = new VapiKrosCommunicationAdapter(environment, fetchImpl);
    const refreshed = await adapter.refreshCommunication(persistedCommunication());

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(refreshed.id).toBe("communication-refresh");
    expect(refreshed.status).toBe("IN_PROGRESS");
    expect(refreshed.externalId).toBe("call-refresh-123");
    expect(refreshed.occurredAt).toBe("2026-10-03T00:21:30.000Z");
  });

  it("maps a no-answer ended reason without creating Quote evidence", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        id: "call-refresh-123",
        assistantId: "assistant-sabi",
        status: "ended",
        endedReason: "customer-did-not-answer",
        updatedAt: "2026-10-03T00:22:00.000Z"
      })
    ) as typeof fetch;

    const adapter = new VapiKrosCommunicationAdapter(environment, fetchImpl);
    const refreshed = await adapter.refreshCommunication(persistedCommunication());

    expect(refreshed.status).toBe("NO_ANSWER");
    expect(refreshed.errorCode).toBe("customer-did-not-answer");
    expect(refreshed.observation).toBeUndefined();
  });

  it("rejects a Vapi response for a different call id", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        id: "different-call",
        assistantId: "assistant-sabi",
        status: "ended"
      })
    ) as typeof fetch;

    const adapter = new VapiKrosCommunicationAdapter(environment, fetchImpl);

    await expect(
      adapter.refreshCommunication(persistedCommunication())
    ).rejects.toThrow("VAPI_CALL_ID_MISMATCH");
  });

  it("rejects a Vapi response for a different assistant", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        id: "call-refresh-123",
        assistantId: "assistant-other",
        status: "ended"
      })
    ) as typeof fetch;

    const adapter = new VapiKrosCommunicationAdapter(environment, fetchImpl);

    await expect(
      adapter.refreshCommunication(persistedCommunication())
    ).rejects.toThrow("VAPI_ASSISTANT_ID_MISMATCH");
  });
});
