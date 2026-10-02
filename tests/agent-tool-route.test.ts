import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST } from "../app/api/agent-tools/[tool]/route";

const TOKEN = "test-agent-tool-token";

function request(body: unknown, authorized = true) {
  return new Request("http://sabi.test/api/agent-tools/test", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authorized ? { authorization: `Bearer ${TOKEN}` } : {})
    },
    body: JSON.stringify(body)
  });
}

describe("bounded agent HTTP route", () => {
  beforeEach(() => {
    process.env.SABI_AGENT_TOOL_TOKEN = TOKEN;
    process.env.SABI_COMMUNICATION_MODE = "mock";
    delete process.env.SABI_LIVE_TEST_PROVIDERS_JSON;
  });

  afterEach(() => {
    delete process.env.SABI_AGENT_TOOL_TOKEN;
    delete process.env.SABI_COMMUNICATION_MODE;
    delete process.env.SABI_LIVE_TEST_PROVIDERS_JSON;
  });

  it("rejects an unauthenticated agent tool request", async () => {
    const response = await POST(
      request({ mode: "SIMULATION" }, false),
      { params: { tool: "search-providers" } }
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "UNAUTHORIZED_AGENT_TOOL_REQUEST"
    });
  });

  it("returns explicitly labelled simulation providers", async () => {
    const response = await POST(
      request({ mode: "SIMULATION", category: "Perfume" }),
      { params: { tool: "search-providers" } }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.tool).toBe("searchProviders");
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.meta).toEqual({
      source: "explicit-simulation-provider-fixtures",
      liveDirectory: false,
      dialingNumberExposed: false
    });
  });

  it("refuses to substitute simulation fixtures for an unconfigured live provider search", async () => {
    const response = await POST(
      request({ mode: "LIVE" }),
      { params: { tool: "search-providers" } }
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("LIVE_PROVIDER_DIRECTORY_NOT_CONFIGURED");
  });

  it("returns configured live provider metadata without exposing a dialing number", async () => {
    process.env.SABI_LIVE_TEST_PROVIDERS_JSON = JSON.stringify([
      {
        id: "provider-consented-fabric",
        name: "Consented Fabric Test Provider",
        category: "Fabric",
        location: "Lagos",
        languages: ["English"],
        verified: false,
        active: true
      }
    ]);

    const response = await POST(
      request({ mode: "LIVE", category: "Fabric" }),
      { params: { tool: "search-providers" } }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("provider-consented-fabric");
    expect(body.data[0].phone).toBeUndefined();
    expect(body.meta).toEqual({
      source: "configured-live-test-provider-metadata",
      liveDirectory: true,
      dialingNumberExposed: false
    });
  });

  it("refuses live mission orchestration while live communication is disabled", async () => {
    const response = await POST(
      request({ missionId: "mission-test", mode: "LIVE" }),
      { params: { tool: "orchestrate-mission" } }
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("LIVE_COMMUNICATION_NOT_ENABLED");
  });
});
