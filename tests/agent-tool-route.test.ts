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
  });

  afterEach(() => {
    delete process.env.SABI_AGENT_TOOL_TOKEN;
    delete process.env.SABI_COMMUNICATION_MODE;
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
      request({ mode: "SIMULATION", category: "Fabric" }),
      { params: { tool: "search-providers" } }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.tool).toBe("searchProviders");
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.meta).toEqual({
      source: "explicit-simulation-provider-fixtures",
      liveDirectory: false
    });
  });

  it("refuses to substitute simulation fixtures for a live provider search", async () => {
    const response = await POST(
      request({ mode: "LIVE" }),
      { params: { tool: "search-providers" } }
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("LIVE_PROVIDER_DIRECTORY_NOT_CONFIGURED");
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
