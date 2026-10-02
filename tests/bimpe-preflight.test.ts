import { describe, expect, it, vi } from "vitest";
import { runBimpePreflight } from "../lib/integrations/bimpe/preflight";

const providerDirectory = JSON.stringify([
  {
    id: "provider-perfume-test",
    name: "Consenting Perfume Test Provider",
    category: "Perfume",
    location: "Lagos",
    languages: ["English"],
    verified: false,
    active: true
  }
]);

function readyEnvironment(overrides: Record<string, string | undefined> = {}) {
  return {
    SABI_COMMUNICATION_MODE: "bimpe",
    BIMPEAI_BASE_URL: "https://api.bimpe.ai/api/v1/console",
    BIMPEAI_API_KEY: "sk_test_key",
    BIMPEAI_AGENT_ID: "agt_perfume",
    BIMPEAI_WORKFLOW_ID: "wf_perfume",
    BIMPEAI_TEST_CALLS: "true",
    SABI_OPERATOR_TOKEN: "operator-token",
    SABI_AGENT_TOOL_TOKEN: "agent-tool-token",
    SABI_LIVE_TEST_PROVIDERS_JSON: providerDirectory,
    SABI_CONSENTED_PROVIDER_PHONES_JSON: JSON.stringify({
      "provider-perfume-test": "+2348012345678"
    }),
    ...overrides
  };
}

describe("BimpeAI no-call preflight", () => {
  it("does not make a remote request when credentials are missing", async () => {
    const fetchMock = vi.fn();

    const result = await runBimpePreflight({}, fetchMock as unknown as typeof fetch);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.remote.attempted).toBe(false);
    expect(result.canAttemptTestCall).toBe(false);
    expect(result.externalActionPerformed).toBe(false);
    expect(result.phoneNumbersExposed).toBe(false);
    expect(result.secretsExposed).toBe(false);
  });

  it("passes only after local consent gates and read-only Bimpe agent verification succeed", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        message: "Agents retrieved.",
        data: [
          {
            id: "agt_perfume",
            name: "SABI Perfume Procurement",
            workflow_id: "wf_perfume"
          }
        ],
        meta: {
          total_count: 1,
          page_count: 1,
          current_page: 1,
          limit: 100,
          has_next_page: false,
          has_previous_page: false
        }
      })
    );

    const result = await runBimpePreflight(
      readyEnvironment(),
      fetchMock as unknown as typeof fetch
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.bimpe.ai/api/v1/console/agents?limit=100"
    );
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ method: "GET" })
    );
    expect(result.local.consentedProviderMatchCount).toBe(1);
    expect(result.remote.credentialsAccepted).toBe(true);
    expect(result.remote.agentVisible).toBe(true);
    expect(result.remote.workflowMatches).toBe(true);
    expect(result.canAttemptTestCall).toBe(true);
    expect(result.externalActionPerformed).toBe(false);
  });

  it("rejects an API key that Bimpe returns as unauthorized", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(
        {
          message: "Invalid API key.",
          code: "api_key_invalid"
        },
        { status: 401 }
      )
    );

    const result = await runBimpePreflight(
      readyEnvironment(),
      fetchMock as unknown as typeof fetch
    );

    expect(result.remote.apiReachable).toBe(true);
    expect(result.remote.credentialsAccepted).toBe(false);
    expect(result.remote.reason).toBe("BIMPE_API_KEY_REJECTED");
    expect(result.canAttemptTestCall).toBe(false);
  });

  it("stays blocked when the configured workflow differs from the agent workflow", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        data: [
          {
            id: "agt_perfume",
            name: "SABI Perfume Procurement",
            workflow_id: "wf_other"
          }
        ]
      })
    );

    const result = await runBimpePreflight(
      readyEnvironment(),
      fetchMock as unknown as typeof fetch
    );

    expect(result.remote.agentVisible).toBe(true);
    expect(result.remote.workflowMatches).toBe(false);
    expect(result.remote.reason).toBe("BIMPE_WORKFLOW_MISMATCH");
    expect(result.canAttemptTestCall).toBe(false);
  });

  it("stays blocked when a phone is consented for an ID not present in the provider directory", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        data: [
          {
            id: "agt_perfume",
            name: "SABI Perfume Procurement",
            workflow_id: "wf_perfume"
          }
        ]
      })
    );

    const result = await runBimpePreflight(
      readyEnvironment({
        SABI_CONSENTED_PROVIDER_PHONES_JSON: JSON.stringify({
          "provider-someone-else": "+2348012345678"
        })
      }),
      fetchMock as unknown as typeof fetch
    );

    expect(result.local.consentMapValid).toBe(true);
    expect(result.local.consentedProviderMatchCount).toBe(0);
    expect(result.local.consentedProviderMatchReady).toBe(false);
    expect(result.canAttemptTestCall).toBe(false);
  });

  it("stays blocked when the consent map contains an invalid phone format", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        data: [
          {
            id: "agt_perfume",
            workflow_id: "wf_perfume"
          }
        ]
      })
    );

    const result = await runBimpePreflight(
      readyEnvironment({
        SABI_CONSENTED_PROVIDER_PHONES_JSON: JSON.stringify({
          "provider-perfume-test": "08012345678"
        })
      }),
      fetchMock as unknown as typeof fetch
    );

    expect(result.local.consentMapValid).toBe(false);
    expect(result.local.consentedProviderMatchReady).toBe(false);
    expect(result.canAttemptTestCall).toBe(false);
  });
});
