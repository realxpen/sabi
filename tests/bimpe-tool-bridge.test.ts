import { describe, expect, it } from "vitest";
import { quoteSchema } from "../lib/schemas";
import {
  bimpeCustomApiTools,
  handleBimpeToolRequest
} from "../lib/integrations/bimpe/tool-bridge";

const environment = {
  SABI_AGENT_TOOL_TOKEN: "bridge-test-secret"
};

function toolRequest(body: unknown, token = "bridge-test-secret") {
  return new Request("https://sabi.example/api/agent-tools/test", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

describe("Bimpe bounded agent tool bridge", () => {
  it("fails closed when the bridge bearer token is not configured", async () => {
    const response = await handleBimpeToolRequest(
      toolRequest({}),
      "searchProviders",
      { environment: {} }
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "AGENT_TOOL_AUTH_NOT_CONFIGURED",
      message: "SABI_AGENT_TOOL_TOKEN is not configured."
    });
  });

  it("rejects an incorrect bearer token without exposing either token", async () => {
    const response = await handleBimpeToolRequest(
      toolRequest({}, "wrong-secret"),
      "searchProviders",
      { environment }
    );
    const payload = await response.text();

    expect(response.status).toBe(401);
    expect(payload).not.toContain("wrong-secret");
    expect(payload).not.toContain("bridge-test-secret");
  });

  it("exposes provider search as an explicitly temporary demo source", async () => {
    const response = await handleBimpeToolRequest(
      toolRequest({ location: "Yaba" }),
      "searchProviders",
      { environment }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0].id).toBe("provider-tola-fabrics");
    expect(payload.meta).toEqual({
      source: "temporary-demo-providers",
      liveDirectory: false
    });
  });

  it("returns one bounded provider record", async () => {
    const response = await handleBimpeToolRequest(
      toolRequest({ providerId: "provider-ade-textiles" }),
      "getProvider",
      { environment }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.id).toBe("provider-ade-textiles");
    expect(payload.meta.liveDirectory).toBe(false);
  });

  it("keeps callProvider truthful in mock mode until a live adapter is injected", async () => {
    const response = await handleBimpeToolRequest(
      toolRequest({
        missionId: "mission-demo",
        providerId: "provider-ade-textiles",
        objective: "Confirm stock and price"
      }),
      "callProvider",
      { environment }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.channel).toBe("MOCK");
    expect(payload.meta.liveCommunication).toBe(false);
    expect(payload.data.summary).toContain("No real provider was contacted");
  });

  it("marks HTTP recordQuote output as validated but not persisted", async () => {
    const response = await handleBimpeToolRequest(
      toolRequest({
        missionId: "mission-demo",
        providerId: "provider-ade-textiles",
        available: true,
        price: 62000,
        source: "CALL",
        sourceReference: "communication-demo"
      }),
      "recordQuote",
      { environment }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.price).toBe(62000);
    expect(payload.data.deliveryFee).toBeUndefined();
    expect(payload.data.total).toBeUndefined();
    expect(payload.meta.persisted).toBe(false);
  });

  it("fails requestApproval closed when no Quote lookup is configured", async () => {
    const response = await handleBimpeToolRequest(
      toolRequest({
        missionId: "mission-demo",
        providerId: "provider-ade-textiles",
        quoteId: "quote-demo"
      }),
      "requestApproval",
      { environment }
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: "APPROVAL_QUOTE_LOOKUP_NOT_CONFIGURED"
    });
  });

  it("creates only a pending human approval when an explicit Quote lookup is injected", async () => {
    const quote = quoteSchema.parse({
      id: "quote-demo",
      missionId: "mission-demo",
      providerId: "provider-ade-textiles",
      available: true,
      price: 62000,
      source: "CALL",
      sourceReference: "communication-demo",
      createdAt: new Date().toISOString()
    });

    const response = await handleBimpeToolRequest(
      toolRequest({
        missionId: "mission-demo",
        providerId: "provider-ade-textiles",
        quoteId: "quote-demo"
      }),
      "requestApproval",
      {
        environment,
        quoteLookup: (quoteId) => (quoteId === quote.id ? quote : undefined)
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.status).toBe("PENDING");
    expect(payload.data.action).toBe("SELECT_PROVIDER");
    expect(payload.meta.transactionCommitted).toBe(false);
  });

  it("publishes only documented Custom API tool registration fields", () => {
    expect(bimpeCustomApiTools).toEqual([
      {
        name: "Search Providers",
        http_method: "POST",
        url_template: "/api/agent-tools/search-providers"
      },
      {
        name: "Get Provider",
        http_method: "POST",
        url_template: "/api/agent-tools/get-provider"
      },
      {
        name: "Call Provider",
        http_method: "POST",
        url_template: "/api/agent-tools/call-provider"
      },
      {
        name: "Record Quote",
        http_method: "POST",
        url_template: "/api/agent-tools/record-quote"
      },
      {
        name: "Request Approval",
        http_method: "POST",
        url_template: "/api/agent-tools/request-approval"
      }
    ]);
  });
});
