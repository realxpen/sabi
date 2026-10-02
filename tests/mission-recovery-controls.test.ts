import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemoMissionSnapshot } from "../lib/mission/demo-engine";
import type { MissionSnapshot } from "../lib/mission/snapshot";

const repositoryMocks = vi.hoisted(() => ({
  current: undefined as MissionSnapshot | undefined,
  getMissionSnapshot: vi.fn(),
  saveMissionSnapshot: vi.fn()
}));

const orchestrationMocks = vi.hoisted(() => ({
  advanceMissionOrchestration: vi.fn()
}));

vi.mock("../lib/integrations/neon/mission-snapshot-repository", () => ({
  getMissionSnapshot: repositoryMocks.getMissionSnapshot,
  saveMissionSnapshot: repositoryMocks.saveMissionSnapshot
}));

vi.mock("../lib/mission/orchestrator", () => ({
  advanceMissionOrchestration: orchestrationMocks.advanceMissionOrchestration
}));

import { POST as restartMission } from "../app/api/missions/[id]/restart/route";
import { POST as continueMission } from "../app/api/missions/[id]/continue/route";

describe("mission demo and recovery controls", () => {
  beforeEach(() => {
    repositoryMocks.getMissionSnapshot.mockReset();
    repositoryMocks.saveMissionSnapshot.mockReset();
    orchestrationMocks.advanceMissionOrchestration.mockReset();

    repositoryMocks.getMissionSnapshot.mockImplementation(async () =>
      repositoryMocks.current
    );
    repositoryMocks.saveMissionSnapshot.mockImplementation(async (snapshot) => {
      repositoryMocks.current = snapshot;
      return snapshot;
    });

    process.env.SABI_OPERATOR_TOKEN = "operator-test-token";
  });

  it("restarts only a labelled simulation and clears generated runtime state", async () => {
    repositoryMocks.current = buildDemoMissionSnapshot(
      "I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.",
      "mission-restart"
    );

    const response = await restartMission(
      new Request("http://sabi.test/api/missions/mission-restart/restart", {
        method: "POST"
      }),
      { params: { id: "mission-restart" } }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.restarted).toBe(true);
    expect(body.externalActionAttempted).toBe(false);
    expect(repositoryMocks.current?.mission.status).toBe("CREATED");
    expect(repositoryMocks.current?.providers).toHaveLength(0);
    expect(repositoryMocks.current?.communications).toHaveLength(0);
    expect(repositoryMocks.current?.quotes).toHaveLength(0);
    expect(repositoryMocks.current?.recommendation).toBeUndefined();
  });

  it("refuses to restart a live mission", async () => {
    const snapshot = buildDemoMissionSnapshot(
      "Find a fabric provider in Yaba.",
      "mission-live-restart"
    );
    repositoryMocks.current = { ...snapshot, demoMode: false };

    const response = await restartMission(
      new Request("http://sabi.test/api/missions/mission-live-restart/restart", {
        method: "POST"
      }),
      { params: { id: "mission-live-restart" } }
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("LIVE_MISSION_RESTART_NOT_ALLOWED");
    expect(repositoryMocks.saveMissionSnapshot).not.toHaveBeenCalled();
  });

  it("continues a live mission only from already-contacted recovery stages", async () => {
    const snapshot = buildDemoMissionSnapshot(
      "Find a fabric provider in Yaba.",
      "mission-safe-continue"
    );
    const liveSnapshot: MissionSnapshot = {
      ...snapshot,
      demoMode: false,
      mission: { ...snapshot.mission, status: "COLLECTING_QUOTES" }
    };
    repositoryMocks.current = liveSnapshot;
    orchestrationMocks.advanceMissionOrchestration.mockResolvedValue({
      snapshot: liveSnapshot,
      outcome: "WAITING",
      reason: "WAITING_FOR_VALIDATED_QUOTES"
    });

    const response = await continueMission(
      new Request("http://sabi.test/api/missions/mission-safe-continue/continue", {
        method: "POST",
        headers: { authorization: "Bearer operator-test-token" }
      }),
      { params: { id: "mission-safe-continue" } }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.externalActionAttempted).toBe(false);
    expect(body.transactionPerformed).toBe(false);
    expect(body.recoveryMode).toBe("SETTLED_EVIDENCE_ONLY");
    expect(orchestrationMocks.advanceMissionOrchestration).toHaveBeenCalledWith(
      "mission-safe-continue",
      { mode: "LIVE" }
    );
  });

  it("refuses operator continuation from CONTACTING so it cannot initiate a call", async () => {
    const snapshot = buildDemoMissionSnapshot(
      "Find a fabric provider in Yaba.",
      "mission-contacting"
    );
    repositoryMocks.current = {
      ...snapshot,
      demoMode: false,
      mission: { ...snapshot.mission, status: "CONTACTING" }
    };

    const response = await continueMission(
      new Request("http://sabi.test/api/missions/mission-contacting/continue", {
        method: "POST",
        headers: { authorization: "Bearer operator-test-token" }
      }),
      { params: { id: "mission-contacting" } }
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("MISSION_NOT_READY_FOR_SAFE_CONTINUE");
    expect(orchestrationMocks.advanceMissionOrchestration).not.toHaveBeenCalled();
  });
});
