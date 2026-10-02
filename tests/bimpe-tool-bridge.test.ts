import { describe, expect, it } from "vitest";
import {
  approvalSchema,
  quoteSchema,
  type Approval,
  type Quote
} from "../lib/schemas";
import type { ApprovalRepository } from "../lib/repositories/approval-repository";
import type { QuoteRepository } from "../lib/repositories/quote-repository";
import {
  bimpeCustomApiTools,
  handleBimpeToolRequest
} from "../lib/integrations/bimpe/tool-bridge";

const environment = {
  SABI_AGENT_TOOL_TOKEN: "bridge-test-secret"
};

class TestQuoteRepository implements QuoteRepository {
  private readonly quotes = new Map<string, Quote>();

  async save(quote: Quote): Promise<Quote> {
    this.quotes.set(quote.id, quote);
    return quote;
  }

  async getById(quoteId: string): Promise<Quote | undefined> {
    return this.quotes.get(quoteId);
  }
}

class TestApprovalRepository implements ApprovalRepository {
  private readonly approvals = new Map<string, Approval>();

  async save(approval: Approval): Promise<Approval> {
    const validated = approvalSchema.parse(approval);
    this.approvals.set(validated.id, validated);
    return validated;
  }

  async getById(approvalId: string): Promise<Approval | undefined> {
    return this.approvals.get(approvalId);
  }
}

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

  it("exposes provider search as an explicitly temporary demo source with a fresh mission ID", async () => {
    const firstResponse = await handleBimpeToolRequest(
      toolRequest({ location: "Yaba" }),
      "searchProviders",
      { environment }
    );
    const firstPayload = await firstResponse.json();

    const secondResponse = await handleBimpeToolRequest(
      toolRequest({ location: "Yaba" }),
      "searchProviders",
      { environment }
    );
    const secondPayload = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(firstPayload.data).toHaveLength(1);
    expect(firstPayload.data[0].id).toBe("provider-tola-fabrics");
    expect(firstPayload.meta).toMatchObject({
      source: "temporary-demo-providers",
      liveDirectory: false,
      missionIdPolicy:
        "Reuse this missionId for all stateful SABI tool calls in the current sourcing mission."
    });
    expect(firstPayload.meta.missionId).toMatch(
      /^mission-bimpe-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(secondPayload.meta.missionId).toMatch(/^mission-bimpe-/);
    expect(secondPayload.meta.missionId).not.toBe(firstPayload.meta.missionId);
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
    expect(payload.meta.missionId).toBe("mission-demo");
    expect(payload.meta.liveCommunication).toBe(false);
    expect(payload.data.summary).toContain("No real provider was contacted");
  });

  it("rejects the legacy static mission-001 placeholder on stateful tool calls", async () => {
    const response = await handleBimpeToolRequest(
      toolRequest({
        missionId: "mission-001",
        providerId: "provider-ade-textiles",
        objective: "Confirm stock and price"
      }),
      "callProvider",
      { environment }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("INVALID_AGENT_TOOL_INPUT");
    expect(payload.details.fieldErrors.missionId).toContain(
      "Static mission-001 is not allowed. Reuse the missionId returned by Search Providers for the current sourcing mission."
    );
  });

  it("exposes sendMessage but fails closed when no verified messaging transport is configured", async () => {
    const response = await handleBimpeToolRequest(
      toolRequest({
        missionId: "mission-demo",
        providerId: "provider-ade-textiles",
        communicationId: "communication-message-demo",
        message: "Please confirm stock and price."
      }),
      "sendMessage",
      { environment }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.channel).toBe("SMS");
    expect(payload.data.status).toBe("UNAVAILABLE");
    expect(payload.data.summary).toContain("no message was sent");
    expect(payload.meta.missionId).toBe("mission-demo");
    expect(payload.meta.transportConfigured).toBe(false);
    expect(payload.meta.externalMessageAccepted).toBe(false);
    expect(payload.meta.quoteCreated).toBe(false);
  });

  it("fails recordQuote closed when durable storage is not configured", async () => {
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

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: "QUOTE_REPOSITORY_NOT_CONFIGURED"
    });
  });

  it("returns success only after a Quote repository stores the canonical Quote", async () => {
    const quoteRepository = new TestQuoteRepository();
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
      { environment, quoteRepository }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.price).toBe(62000);
    expect(payload.data.deliveryFee).toBeUndefined();
    expect(payload.data.total).toBeUndefined();
    expect(payload.meta.missionId).toBe("mission-demo");
    expect(payload.meta.persisted).toBe(true);
    expect(await quoteRepository.getById(payload.data.id)).toEqual(payload.data);
  });

  it("fails requestApproval closed when no Quote repository or lookup is configured", async () => {
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

  it("fails closed when a stored Quote exists but Approval persistence is missing", async () => {
    const quoteRepository = new TestQuoteRepository();
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
    await quoteRepository.save(quote);

    const response = await handleBimpeToolRequest(
      toolRequest({
        missionId: "mission-demo",
        providerId: "provider-ade-textiles",
        quoteId: "quote-demo"
      }),
      "requestApproval",
      { environment, quoteRepository }
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: "APPROVAL_REPOSITORY_NOT_CONFIGURED"
    });
  });

  it("loads a stored Quote and persists a pending human approval", async () => {
    const quoteRepository = new TestQuoteRepository();
    const approvalRepository = new TestApprovalRepository();
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
    await quoteRepository.save(quote);

    const response = await handleBimpeToolRequest(
      toolRequest({
        missionId: "mission-demo",
        providerId: "provider-ade-textiles",
        quoteId: "quote-demo"
      }),
      "requestApproval",
      { environment, quoteRepository, approvalRepository }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.status).toBe("PENDING");
    expect(payload.data.action).toBe("SELECT_PROVIDER");
    expect(payload.meta.missionId).toBe("mission-demo");
    expect(payload.meta.quoteLoadedFromRepository).toBe(true);
    expect(payload.meta.approvalPersisted).toBe(true);
    expect(payload.meta.approvalStorage).toBe("neon-postgres");
    expect(payload.meta.transactionCommitted).toBe(false);
    expect(await approvalRepository.getById(payload.data.id)).toEqual(payload.data);
  });

  it("still supports an explicit Quote lookup injection for non-production callers", async () => {
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
    expect(payload.meta.missionId).toBe("mission-demo");
    expect(payload.meta.approvalPersisted).toBe(false);
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
        name: "Send Message",
        http_method: "POST",
        url_template: "/api/agent-tools/send-message"
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
