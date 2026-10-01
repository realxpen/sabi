import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemoMissionSnapshot } from "../lib/mission/demo-engine";

const repositoryMocks = vi.hoisted(() => ({
  current: undefined as unknown,
  getMissionSnapshot: vi.fn(),
  saveMissionSnapshot: vi.fn()
}));

vi.mock("../lib/integrations/neon/mission-snapshot-repository", () => ({
  getMissionSnapshot: repositoryMocks.getMissionSnapshot,
  saveMissionSnapshot: repositoryMocks.saveMissionSnapshot
}));

import { POST } from "../app/api/missions/[id]/cancel/route";

describe("mission cancellation route", () => {
  beforeEach(() => {
    repositoryMocks.getMissionSnapshot.mockReset();
    repositoryMocks.saveMissionSnapshot.mockReset();
    repositoryMocks.getMissionSnapshot.mockImplementation(async () =>
      repositoryMocks.current
    );
    repositoryMocks.saveMissionSnapshot.mockImplementation(async (snapshot) => {
      repositoryMocks.current = snapshot;
      return snapshot;
    });
  });

  it("persists cancellation at the human approval checkpoint without a transaction", async () => {
    const snapshot = buildDemoMissionSnapshot(
      "I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.",
      "mission-cancel"
    );
    repositoryMocks.current = snapshot;

    const response = await POST(
      new Request("http://sabi.test/api/missions/mission-cancel/cancel", {
        method: "POST"
      }),
      { params: { id: "mission-cancel" } }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.missionStatus).toBe("CANCELLED");
    expect(body.persisted).toBe(true);
    expect(body.transactionPerformed).toBe(false);
    expect(repositoryMocks.current.mission.status).toBe("CANCELLED");
    expect(repositoryMocks.current.steps.at(-1)?.type).toBe("HUMAN_CANCELLED");
  });

  it("refuses cancellation after a terminal mission state", async () => {
    const snapshot = buildDemoMissionSnapshot(
      "I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.",
      "mission-completed"
    );
    repositoryMocks.current = {
      ...snapshot,
      mission: { ...snapshot.mission, status: "COMPLETED" }
    };

    const response = await POST(
      new Request("http://sabi.test/api/missions/mission-completed/cancel", {
        method: "POST"
      }),
      { params: { id: "mission-completed" } }
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("MISSION_CANNOT_BE_CANCELLED");
    expect(repositoryMocks.saveMissionSnapshot).not.toHaveBeenCalled();
  });
});
