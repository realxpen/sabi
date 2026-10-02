import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildInitialMissionSnapshot } from "../lib/mission/initial-snapshot";
import { communicationResultSchema, providerSchema } from "../lib/schemas";

const repositoryMocks = vi.hoisted(() => ({
  getMissionSnapshot: vi.fn(),
  saveMissionSnapshot: vi.fn()
}));

const runtimeMocks = vi.hoisted(() => ({
  callProviderForAgent: vi.fn(),
  refreshCommunicationForAgent: vi.fn(),
  getCommunicationEvidenceForAgent: vi.fn(),
  advanceMissionOrchestration: vi.fn()
}));

vi.mock("../lib/integrations/neon/mission-snapshot-repository", () =>
  repositoryMocks
);
vi.mock("../lib/integrations/bimpe/communication-runtime", () => ({
  callProviderForAgent: runtimeMocks.callProviderForAgent,
  refreshCommunicationForAgent: runtimeMocks.refreshCommunicationForAgent
}));
vi.mock("../lib/integrations/bimpe/communication-evidence", () => ({
  getCommunicationEvidenceForAgent: runtimeMocks.getCommunicationEvidenceForAgent
}));
vi.mock("../lib/mission/orchestrator", () => ({
  advanceMissionOrchestration: runtimeMocks.advanceMissionOrchestration
}));

import {
  startLiveVoiceTestCall
} from "../lib/mission/live-voice-test";
import { POST as liveVoiceTestRoute } from "../app/api/missions/[id]/live-voice-test/route";

const PERFUME_REQUEST =
  "I need 12 bottles of 50ml long-lasting unisex perfume delivered to Yaba tomorrow. My budget is ₦120,000.";

const provider = providerSchema.parse({
  id: "provider-perfume-consenting",
  name: "Consenting Perfume Test Provider",
  category: "Perfume",
  location: "Lagos",
  languages: ["English"],
  verified: false,
  active: true
});

function liveContactingSnapshot() {
  const base = buildInitialMissionSnapshot(
    PERFUME_REQUEST,
    "mission-live-voice",
    false
  );

  return {
    ...base,
    mission: { ...base.mission, status: "CONTACTING" as const },
    providers: [provider]
  };
}

describe("Bimpe Live Voice Test", () => {
  beforeEach(() => {
    process.env.SABI_COMMUNICATION_MODE = "bimpe";
    process.env.SABI_OPERATOR_TOKEN = "operator-test-token";
    repositoryMocks.getMissionSnapshot.mockReset();
    repositoryMocks.saveMissionSnapshot.mockReset();
    runtimeMocks.callProviderForAgent.mockReset();
    runtimeMocks.refreshCommunicationForAgent.mockReset();
    runtimeMocks.getCommunicationEvidenceForAgent.mockReset();
    runtimeMocks.advanceMissionOrchestration.mockReset();
    repositoryMocks.saveMissionSnapshot.mockImplementation(async (snapshot) => snapshot);
  });

  afterEach(() => {
    delete process.env.SABI_COMMUNICATION_MODE;
    delete process.env.SABI_OPERATOR_TOKEN;
  });

  it("calls only the explicitly selected provider and moves into evidence collection", async () => {
    const before = liveContactingSnapshot();
    const communication = communicationResultSchema.parse({
      id: "communication-bimpe-test",
      missionId: before.mission.id,
      providerId: provider.id,
      channel: "CALL",
      status: "INITIATED",
      externalId: "bimpe:call-test-123",
      summary: "BimpeAI test call initiated.",
      occurredAt: "2026-10-02T13:00:00.000Z"
    });
    const afterCall = { ...before, communications: [communication] };

    repositoryMocks.getMissionSnapshot.mockResolvedValue(before);
    runtimeMocks.callProviderForAgent.mockResolvedValue({
      communication,
      snapshot: afterCall,
      reusedExistingActiveCommunication: false
    });

    const result = await startLiveVoiceTestCall(
      before.mission.id,
      provider.id
    );

    expect(runtimeMocks.callProviderForAgent).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.callProviderForAgent).toHaveBeenCalledWith({
      missionId: before.mission.id,
      providerId: provider.id
    });
    expect(repositoryMocks.saveMissionSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        mission: expect.objectContaining({ status: "COLLECTING_QUOTES" }),
        communications: [communication]
      })
    );
    expect(result.snapshot.mission.status).toBe("COLLECTING_QUOTES");
    expect(result.externalActionAttempted).toBe(true);
    expect(result.transactionPerformed).toBe(false);
  });

  it("rejects a live call when the mission is still a simulation", async () => {
    const demo = buildInitialMissionSnapshot(
      PERFUME_REQUEST,
      "mission-demo-live-test",
      true
    );
    repositoryMocks.getMissionSnapshot.mockResolvedValue({
      ...demo,
      mission: { ...demo.mission, status: "CONTACTING" },
      providers: [provider]
    });

    await expect(
      startLiveVoiceTestCall("mission-demo-live-test", provider.id)
    ).rejects.toThrow("LIVE_TEST_REQUIRES_LIVE_MISSION");
    expect(runtimeMocks.callProviderForAgent).not.toHaveBeenCalled();
  });

  it("requires the supervised operator token at the HTTP boundary", async () => {
    const response = await liveVoiceTestRoute(
      new Request(
        "http://sabi.test/api/missions/mission-live-voice/live-voice-test",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "prepare" })
        }
      ),
      { params: { id: "mission-live-voice" } }
    );

    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe("UNAUTHORIZED_OPERATOR");
  });

  it("returns transcript evidence as evidence-only data", async () => {
    runtimeMocks.getCommunicationEvidenceForAgent.mockResolvedValue({
      missionId: "mission-live-voice",
      providerId: provider.id,
      communicationId: "communication-completed",
      callId: "call-123",
      transcript: "assistant: Can you deliver tomorrow?\nuser: Yes.",
      sourceReference: "bimpe:call-123"
    });
    repositoryMocks.getMissionSnapshot.mockResolvedValue({
      ...liveContactingSnapshot(),
      mission: {
        ...liveContactingSnapshot().mission,
        status: "COLLECTING_QUOTES"
      }
    });

    const response = await liveVoiceTestRoute(
      new Request(
        "http://sabi.test/api/missions/mission-live-voice/live-voice-test",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer operator-test-token"
          },
          body: JSON.stringify({
            action: "evidence",
            communicationId: "communication-completed"
          })
        }
      ),
      { params: { id: "mission-live-voice" } }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.evidence.transcript).toContain("user: Yes.");
    expect(body.evidence.evidenceOnly).toBe(true);
    expect(body.evidence.transcriptPersistedToMission).toBe(false);
    expect(body.evidence.quoteCreated).toBe(false);
    expect(body.transactionPerformed).toBe(false);
  });
});
