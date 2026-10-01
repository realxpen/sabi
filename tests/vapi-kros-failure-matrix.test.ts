import { describe, expect, it } from "vitest";
import { VapiKrosCommunicationAdapter } from "../lib/integrations/communication/vapi-kros";
import { createVapiWebhookPostHandler } from "../lib/integrations/communication/vapi-webhook-handler";

const environment = {
  SABI_COMMUNICATION_MODE: "vapi-kros",
  VAPI_API_BASE_URL: "https://api.vapi.ai",
  VAPI_API_KEY: "private-test-key",
  VAPI_ASSISTANT_ID: "assistant-test",
  VAPI_SIP_TRUNK_CREDENTIAL_ID: "credential-test",
  VAPI_WEBHOOK_TOKEN: "webhook-test-token",
  DATABASE_URL: "postgresql://test:test@localhost/neondb"
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function vapiEvent(overrides: Record<string, unknown> = {}) {
  return {
    message: {
      type: "end-of-call-report",
      timestamp: "2026-10-01T09:00:00.000Z",
      endedReason: "customer-ended-call",
      call: {
        id: "vapi-call-known",
        assistantOverrides: {
          variableValues: {
            missionId: "mission-live-1",
            providerId: "provider-tola-fabrics",
            communicationId: "communication-live-1",
            objective: "Confirm availability and price."
          }
        }
      },
      ...overrides
    }
  };
}

function webhookRequest(body: BodyInit) {
  return new Request("https://sabi.example/api/webhooks/vapi", {
    method: "POST",
    headers: {
      Authorization: "Bearer webhook-test-token",
      "Content-Type": "application/json"
    },
    body
  });
}

describe("Vapi/Kros failure matrix", () => {
  it("normalizes busy as NO_ANSWER and produces no Quote observation", async () => {
    const adapter = new VapiKrosCommunicationAdapter(environment);
    const result = await adapter.normalizeEvent(
      vapiEvent({ endedReason: "customer-busy" })
    );

    expect(result.status).toBe("NO_ANSWER");
    expect(result.errorCode).toBe("customer-busy");
    expect(result.observation).toBeUndefined();
    expect(result.summary).toContain("No Quote evidence was produced");
  });

  it("normalizes provider/runtime failures as FAILED and produces no Quote observation", async () => {
    const adapter = new VapiKrosCommunicationAdapter(environment);
    const result = await adapter.normalizeEvent(
      vapiEvent({ endedReason: "error-provider-failed-to-connect" })
    );

    expect(result.status).toBe("FAILED");
    expect(result.errorCode).toBe("error-provider-failed-to-connect");
    expect(result.observation).toBeUndefined();
    expect(result.summary).toContain("No Quote evidence was produced");
  });

  it("rejects malformed webhook JSON before correlation or persistence", async () => {
    const handler = createVapiWebhookPostHandler(environment);
    const response = await handler(webhookRequest("{not-json"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      error: "MALFORMED_VAPI_WEBHOOK_PAYLOAD"
    });
  });

  it("treats an unrecognized call without SABI correlation variables as UNKNOWN_CORRELATION", async () => {
    const handler = createVapiWebhookPostHandler(environment);
    const response = await handler(
      webhookRequest(
        JSON.stringify({
          message: {
            type: "end-of-call-report",
            timestamp: "2026-10-01T09:00:00.000Z",
            endedReason: "customer-ended-call",
            call: {
              id: "vapi-call-unknown"
            }
          }
        })
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.ok).toBe(true);
    expect(payload.kind).toBe("UNKNOWN_CORRELATION");
    expect(payload.eventId).toMatch(/^vapi-/);
    expect(payload.quoteCreated).toBeUndefined();
  });

  it("rejects a correlated webhook when Vapi does not recognize the call ID", async () => {
    const fetchStub = (async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toBe("https://api.vapi.ai/call/vapi-call-known");
      return jsonResponse({ message: "not found" }, 404);
    }) as typeof fetch;
    const handler = createVapiWebhookPostHandler(
      environment,
      fetchStub
    );
    const response = await handler(
      webhookRequest(JSON.stringify(vapiEvent()))
    );
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload).toMatchObject({
      ok: true,
      kind: "UNKNOWN_CALL",
      callId: "vapi-call-known"
    });
    expect(payload.eventId).toMatch(/^vapi-/);
    expect(payload.quoteCreated).toBeUndefined();
  });

  it("rejects a Vapi call ID that belongs to a different assistant", async () => {
    const fetchStub = (async () =>
      jsonResponse({
        id: "vapi-call-known",
        assistantId: "assistant-other"
      })) as typeof fetch;
    const handler = createVapiWebhookPostHandler(
      environment,
      fetchStub
    );
    const response = await handler(
      webhookRequest(JSON.stringify(vapiEvent()))
    );
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.kind).toBe("UNKNOWN_CALL");
    expect(payload.callId).toBe("vapi-call-known");
  });

  it("fails closed when live webhook processing is not explicitly enabled", async () => {
    const handler = createVapiWebhookPostHandler({
      ...environment,
      SABI_COMMUNICATION_MODE: "mock"
    });
    const response = await handler(
      webhookRequest(JSON.stringify(vapiEvent()))
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      ok: false,
      error: "VAPI_LIVE_COMMUNICATION_NOT_ENABLED"
    });
  });
});
