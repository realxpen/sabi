import { describe, expect, it, vi } from "vitest";
import {
  BimpeAICommunicationAdapter,
  getBimpeCallDetail
} from "../lib/integrations/communication/bimpe-ai";
import { getBimpeCallEvidence } from "../lib/integrations/voice-runtime/bimpe-evidence";

const environment = {
  BIMPEAI_API_KEY: "sk_test_bimpe",
  BIMPEAI_BASE_URL: "https://api.bimpe.ai/api/v1/console",
  BIMPEAI_AGENT_ID: "agent-perfume",
  BIMPEAI_TEST_CALLS: "true",
  SABI_CONSENTED_PROVIDER_PHONES_JSON: JSON.stringify({
    "provider-perfume-test": "+2348012345678"
  })
};

describe("BimpeAI communication adapter", () => {
  it("initiates one consent-gated Bimpe test call and returns an INITIATED CommunicationResult", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe(
        "https://api.bimpe.ai/api/v1/console/agents/agent-perfume/calls"
      );
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBe("Bearer sk_test_bimpe");
      expect(headers.get("idempotency-key")).toBe(
        "sabi-mission-perfume-provider-perfume-test"
      );
      expect(JSON.parse(String(init?.body))).toEqual({
        destination: "+2348012345678",
        is_test_call: true
      });

      return Response.json(
        {
          message: "Success",
          data: {
            status: "initiated",
            call_id: "call-bimpe-123",
            detail: "test call accepted"
          }
        },
        { status: 201 }
      );
    }) as typeof fetch;

    const adapter = new BimpeAICommunicationAdapter(environment, fetchImpl);
    const result = await adapter.initiateContact({
      missionId: "mission-perfume",
      providerId: "provider-perfume-test",
      objective: "Confirm perfume price and delivery"
    });

    expect(result.status).toBe("INITIATED");
    expect(result.channel).toBe("CALL");
    expect(result.externalId).toBe("bimpe:call-bimpe-123");
    expect(result.observation).toBeUndefined();
  });

  it("maps an ended Bimpe call to COMPLETED without manufacturing provider facts", async () => {
    const adapter = new BimpeAICommunicationAdapter(environment, vi.fn() as unknown as typeof fetch);
    const result = await adapter.normalizeEvent({
      missionId: "mission-perfume",
      providerId: "provider-perfume-test",
      communicationId: "communication-existing",
      call: {
        id: "call-bimpe-123",
        status: "ended",
        ended_at: "2026-10-02T12:00:00.000Z",
        conversation_logs: [
          { role: "assistant", content: "What is your total price?" },
          { role: "user", content: "It is one hundred and one thousand naira." }
        ]
      }
    });

    expect(result.id).toBe("communication-existing");
    expect(result.status).toBe("COMPLETED");
    expect(result.externalId).toBe("bimpe:call-bimpe-123");
    expect(result.observation).toBeUndefined();
    expect(result.summary).toContain("no Quote was created automatically");
  });

  it("maps busy to NO_ANSWER", async () => {
    const adapter = new BimpeAICommunicationAdapter(environment, vi.fn() as unknown as typeof fetch);
    const result = await adapter.normalizeEvent({
      missionId: "mission-perfume",
      providerId: "provider-perfume-test",
      call: { id: "call-busy", status: "busy" }
    });

    expect(result.status).toBe("NO_ANSWER");
    expect(result.observation).toBeUndefined();
  });

  it("retrieves final Bimpe transcript evidence separately from Mission state", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe(
        "https://api.bimpe.ai/api/v1/console/agents/agent-perfume/calls/call-bimpe-123"
      );
      expect(new Headers(init?.headers).get("authorization")).toBe(
        "Bearer sk_test_bimpe"
      );
      return Response.json({
        message: "Success",
        data: {
          id: "call-bimpe-123",
          status: "ended",
          conversation_logs: [
            { role: "assistant", content: "Can you deliver tomorrow?" },
            { role: "user", content: "Yes, delivery is five thousand naira." }
          ]
        }
      });
    }) as typeof fetch;

    const call = await getBimpeCallDetail(
      "call-bimpe-123",
      environment,
      fetchImpl
    );
    expect(call.status).toBe("ended");

    const evidence = await getBimpeCallEvidence(
      "bimpe:call-bimpe-123",
      environment,
      fetchImpl
    );

    expect(evidence.callId).toBe("call-bimpe-123");
    expect(evidence.transcript).toContain("user: Yes, delivery is five thousand naira.");
    expect(evidence.sourceReference).toBe("bimpe:call-bimpe-123");
  });
});
