import { beforeEach, describe, expect, it, vi } from "vitest";
import { communicationResultSchema } from "../lib/schemas";
import { buildDemoMissionSnapshot } from "../lib/mission/demo-engine";

const repositoryMocks = vi.hoisted(() => ({
  current: undefined as unknown,
  getMissionSnapshot: vi.fn()
}));

vi.mock("../lib/integrations/neon/mission-snapshot-repository", () => ({
  getMissionSnapshot: repositoryMocks.getMissionSnapshot
}));

import { getCommunicationEvidenceForAgent } from "../lib/integrations/bimpe/communication-evidence";

const environment = {
  VAPI_API_BASE_URL: "https://api.vapi.ai",
  VAPI_API_KEY: "private-test-key",
  VAPI_ASSISTANT_ID: "assistant-sabi"
};

describe("Vapi communication evidence", () => {
  beforeEach(() => {
    repositoryMocks.getMissionSnapshot.mockReset();
  });

  it("returns transcript evidence for the exact completed correlated call", async () => {
    const snapshot = buildDemoMissionSnapshot(
      "I need 20 yards of black Ankara delivered tomorrow.",
      "mission-evidence"
    );
    const communication = communicationResultSchema.parse({
      id: "communication-evidence",
      missionId: snapshot.mission.id,
      providerId: snapshot.providers[0].id,
      channel: "CALL",
      status: "COMPLETED",
      externalId: "call-evidence-123",
      occurredAt: "2026-10-01T21:00:00.000Z"
    });

    repositoryMocks.current = {
      ...snapshot,
      communications: [communication]
    };
    repositoryMocks.getMissionSnapshot.mockResolvedValue(repositoryMocks.current);

    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("https://api.vapi.ai/call/call-evidence-123");
      expect(new Headers(init?.headers).get("authorization")).toBe(
        "Bearer private-test-key"
      );

      return Response.json({
        id: "call-evidence-123",
        assistantId: "assistant-sabi",
        artifact: {
          transcript: [
            { role: "assistant", message: "Is the fabric available?" },
            { role: "user", message: "Yes, total is 63000 naira." }
          ]
        }
      });
    }) as typeof fetch;

    const evidence = await getCommunicationEvidenceForAgent(
      {
        missionId: snapshot.mission.id,
        communicationId: communication.id
      },
      environment,
      fetchImpl
    );

    expect(evidence.callId).toBe("call-evidence-123");
    expect(evidence.providerId).toBe(snapshot.providers[0].id);
    expect(evidence.transcript).toContain("user: Yes, total is 63000 naira.");
    expect(evidence.sourceReference).toBe("call-evidence-123");
  });

  it("supports Vapi OpenAI-formatted message evidence when transcript is absent", async () => {
    const snapshot = buildDemoMissionSnapshot("Find fabric", "mission-openai-evidence");
    const communication = communicationResultSchema.parse({
      id: "communication-openai-evidence",
      missionId: snapshot.mission.id,
      providerId: snapshot.providers[0].id,
      channel: "CALL",
      status: "COMPLETED",
      externalId: "call-openai-evidence",
      occurredAt: "2026-10-01T21:00:00.000Z"
    });

    repositoryMocks.current = { ...snapshot, communications: [communication] };
    repositoryMocks.getMissionSnapshot.mockResolvedValue(repositoryMocks.current);

    const fetchImpl = vi.fn(async () =>
      Response.json({
        id: "call-openai-evidence",
        assistantId: "assistant-sabi",
        artifact: {
          messagesOpenAIFormatted: [
            { role: "assistant", content: "Can you deliver tomorrow?" },
            { role: "user", content: "Yes." }
          ]
        }
      })
    ) as typeof fetch;

    const evidence = await getCommunicationEvidenceForAgent(
      {
        missionId: snapshot.mission.id,
        communicationId: communication.id
      },
      environment,
      fetchImpl
    );

    expect(evidence.transcript).toContain("user: Yes.");
  });

  it("refuses evidence retrieval before communication completes", async () => {
    const snapshot = buildDemoMissionSnapshot("Find fabric", "mission-in-progress");
    const communication = communicationResultSchema.parse({
      id: "communication-in-progress",
      missionId: snapshot.mission.id,
      providerId: snapshot.providers[0].id,
      channel: "CALL",
      status: "IN_PROGRESS",
      externalId: "call-in-progress",
      occurredAt: "2026-10-01T21:00:00.000Z"
    });

    repositoryMocks.current = { ...snapshot, communications: [communication] };
    repositoryMocks.getMissionSnapshot.mockResolvedValue(repositoryMocks.current);

    await expect(
      getCommunicationEvidenceForAgent(
        {
          missionId: snapshot.mission.id,
          communicationId: communication.id
        },
        environment,
        vi.fn() as unknown as typeof fetch
      )
    ).rejects.toThrow("COMMUNICATION_NOT_COMPLETED");
  });

  it("rejects call evidence returned for a different assistant", async () => {
    const snapshot = buildDemoMissionSnapshot("Find fabric", "mission-wrong-assistant");
    const communication = communicationResultSchema.parse({
      id: "communication-wrong-assistant",
      missionId: snapshot.mission.id,
      providerId: snapshot.providers[0].id,
      channel: "CALL",
      status: "COMPLETED",
      externalId: "call-wrong-assistant",
      occurredAt: "2026-10-01T21:00:00.000Z"
    });

    repositoryMocks.current = { ...snapshot, communications: [communication] };
    repositoryMocks.getMissionSnapshot.mockResolvedValue(repositoryMocks.current);

    const fetchImpl = vi.fn(async () =>
      Response.json({
        id: "call-wrong-assistant",
        assistantId: "different-assistant",
        artifact: { transcript: "user: yes" }
      })
    ) as typeof fetch;

    await expect(
      getCommunicationEvidenceForAgent(
        {
          missionId: snapshot.mission.id,
          communicationId: communication.id
        },
        environment,
        fetchImpl
      )
    ).rejects.toThrow("unexpected assistant");
  });
});
