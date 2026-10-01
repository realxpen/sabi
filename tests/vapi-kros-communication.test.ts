import { describe, expect, it } from "vitest";
import { createConfiguredCommunicationAdapter } from "../lib/integrations/communication/live-runtime";
import { MockCommunicationAdapter } from "../lib/integrations/communication/mock";
import {
  VapiKrosCommunicationAdapter
} from "../lib/integrations/communication/vapi-kros";
import { createVapiWebhookPostHandler } from "../lib/integrations/communication/vapi-webhook-handler";
import type { NeonCommunicationEventDedupeSql } from "../lib/integrations/neon/communication-event-deduplicator";
import { callProvider } from "../lib/tools/provider-tools";

const liveEnvironment = {
  SABI_COMMUNICATION_MODE: "vapi-kros",
  SABI_CONSENTED_PROVIDER_PHONES_JSON: JSON.stringify({
    "provider-tola-fabrics": "+2348012345678"
  }),
  VAPI_API_BASE_URL: "https://api.vapi.ai",
  VAPI_API_KEY: "private-test-key",
  VAPI_ASSISTANT_ID: "assistant-test",
  VAPI_SIP_TRUNK_CREDENTIAL_ID: "credential-test"
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function createPersistentSqlMock() {
  const claimed = new Set<string>();
  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?");

    if (text.includes("INSERT INTO communication_event_claims")) {
      const eventId = String(values[0]);
      if (claimed.has(eventId)) return [];
      claimed.add(eventId);
      return [{ event_id: eventId }];
    }

    if (text.includes("DELETE FROM communication_event_claims")) {
      claimed.delete(String(values[0]));
      return [];
    }

    throw new Error("Unexpected SQL in test");
  }) as unknown as NeonCommunicationEventDedupeSql;

  return sql;
}

function vapiEvent(overrides: Record<string, unknown> = {}) {
  return {
    message: {
      type: "end-of-call-report",
      timestamp: "2026-10-01T01:30:00.000Z",
      endedReason: "customer-ended-call",
      call: {
        id: "vapi-call-123",
        assistantOverrides: {
          variableValues: {
            missionId: "mission-live-1",
            providerId: "provider-tola-fabrics",
            communicationId: "communication-live-1",
            objective: "Confirm availability and price."
          }
        }
      },
      artifact: {
        transcript: "Assistant: Hello. Customer: Yes, I can hear you."
      },
      ...overrides
    }
  };
}

describe("configured communication runtime", () => {
  it("defaults to mock so credentials alone cannot activate live calls", () => {
    expect(createConfiguredCommunicationAdapter({})).toBeInstanceOf(
      MockCommunicationAdapter
    );
  });

  it("fails closed without an explicitly consented provider phone mapping", async () => {
    let fetchCalls = 0;
    const fetchStub = (async () => {
      fetchCalls += 1;
      return jsonResponse({});
    }) as typeof fetch;

    const adapter = createConfiguredCommunicationAdapter(
      {
        ...liveEnvironment,
        SABI_CONSENTED_PROVIDER_PHONES_JSON: "{}"
      },
      fetchStub
    );

    const result = await callProvider(
      {
        missionId: "mission-live-1",
        providerId: "provider-tola-fabrics",
        objective: "Confirm availability and price."
      },
      adapter
    );

    expect(fetchCalls).toBe(0);
    expect(result.status).toBe("FAILED");
    expect(result.channel).toBe("CALL");
    expect(result.externalId).toBeUndefined();
    expect(result.summary).toContain("No Quote evidence was produced");
  });
});

describe("VapiKrosCommunicationAdapter", () => {
  it("initiates a Vapi call through the configured BYO SIP number with trusted correlation variables", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchStub = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });

      if (url.endsWith("/phone-number")) {
        return jsonResponse([
          {
            id: "phone-kros-byo",
            provider: "byo-phone-number",
            credentialId: "credential-test"
          }
        ]);
      }

      if (url.endsWith("/call/phone")) {
        return jsonResponse({ id: "vapi-call-123", status: "queued" });
      }

      return jsonResponse({}, 404);
    }) as typeof fetch;

    const adapter = new VapiKrosCommunicationAdapter(
      liveEnvironment,
      fetchStub
    );
    const result = await adapter.initiateContact({
      missionId: "mission-live-1",
      providerId: "provider-tola-fabrics",
      objective: "Confirm 20 yards of black Ankara under N70,000."
    });

    expect(result.status).toBe("INITIATED");
    expect(result.channel).toBe("CALL");
    expect(result.externalId).toBe("vapi-call-123");
    expect(result.summary).toContain("pending verified call events");

    expect(calls.map((call) => call.url)).toEqual([
      "https://api.vapi.ai/phone-number",
      "https://api.vapi.ai/call/phone"
    ]);

    const requestBody = JSON.parse(String(calls[1]?.init?.body));
    expect(requestBody).toMatchObject({
      assistantId: "assistant-test",
      customer: { number: "+2348012345678" },
      phoneNumberId: "phone-kros-byo",
      assistantOverrides: {
        variableValues: {
          missionId: "mission-live-1",
          providerId: "provider-tola-fabrics",
          objective: "Confirm 20 yards of black Ankara under N70,000."
        }
      }
    });
    expect(
      requestBody.assistantOverrides.variableValues.communicationId
    ).toMatch(/^communication-/);
  });

  it("normalizes no-answer without creating Quote observations", async () => {
    const adapter = new VapiKrosCommunicationAdapter(liveEnvironment);
    const result = await adapter.normalizeEvent(
      vapiEvent({
        endedReason: "customer-did-not-answer",
        artifact: undefined
      })
    );

    expect(result.status).toBe("NO_ANSWER");
    expect(result.observation).toBeUndefined();
    expect(result.errorCode).toBe("customer-did-not-answer");
    expect(result.summary).toContain("No Quote evidence was produced");
  });

  it("treats a completed transcript as evidence only, never as a Quote", async () => {
    const adapter = new VapiKrosCommunicationAdapter(liveEnvironment);
    const result = await adapter.normalizeEvent(vapiEvent());

    expect(result.status).toBe("COMPLETED");
    expect(result.observation).toBeUndefined();
    expect(result.summary).toContain("evidence only");
    expect(result.summary).toContain("has not been converted into a Quote");
  });
});

describe("Vapi webhook", () => {
  it("authenticates, correlates and durably deduplicates webhook retries without creating a Quote", async () => {
    const sql = createPersistentSqlMock();
    const environment = {
      ...liveEnvironment,
      VAPI_WEBHOOK_TOKEN: "webhook-test-token",
      DATABASE_URL: "postgresql://test:test@localhost/neondb"
    };
    const handler = createVapiWebhookPostHandler(environment, fetch, sql);
    const body = JSON.stringify(vapiEvent());
    const request = () =>
      new Request("https://sabi.example/api/webhooks/vapi", {
        method: "POST",
        headers: {
          Authorization: "Bearer webhook-test-token",
          "Content-Type": "application/json"
        },
        body
      });

    const first = await handler(request());
    const firstPayload = await first.json();
    const duplicate = await handler(request());
    const duplicatePayload = await duplicate.json();

    expect(first.status).toBe(200);
    expect(firstPayload.kind).toBe("PROCESSED");
    expect(firstPayload.communication).toMatchObject({
      id: "communication-live-1",
      missionId: "mission-live-1",
      providerId: "provider-tola-fabrics",
      status: "COMPLETED",
      externalId: "vapi-call-123"
    });
    expect(firstPayload.communication.observation).toBeUndefined();
    expect(firstPayload.quoteCreated).toBe(false);
    expect(duplicate.status).toBe(200);
    expect(duplicatePayload.kind).toBe("DUPLICATE");
  });

  it("rejects a webhook without the configured bearer credential", async () => {
    const handler = createVapiWebhookPostHandler({
      ...liveEnvironment,
      VAPI_WEBHOOK_TOKEN: "webhook-test-token"
    });
    const response = await handler(
      new Request("https://sabi.example/api/webhooks/vapi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vapiEvent())
      })
    );

    expect(response.status).toBe(401);
  });
});
