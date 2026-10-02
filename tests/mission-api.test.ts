import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemoMissionSnapshot } from "../lib/mission/demo-engine";

const repositoryMocks = vi.hoisted(() => ({
  getMissionSnapshot: vi.fn(),
  saveMissionSnapshot: vi.fn()
}));

vi.mock("../lib/integrations/neon/mission-snapshot-repository", () =>
  repositoryMocks
);

import { POST as createMission } from "../app/api/missions/route";
import { GET as getMission } from "../app/api/missions/[id]/route";
import { POST as approveMission } from "../app/api/missions/[id]/approval/route";

describe("persisted mission API lifecycle", () => {
  beforeEach(() => {
    repositoryMocks.getMissionSnapshot.mockReset();
    repositoryMocks.saveMissionSnapshot.mockReset();
    repositoryMocks.saveMissionSnapshot.mockImplementation(async (snapshot) => snapshot);
  });

  it("creates and persists a mission before returning 201", async () => {
    const response = await createMission(
      new Request("http://sabi.test/api/missions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          request:
            "I need 12 bottles of 50ml long-lasting unisex perfume delivered to Yaba tomorrow. My budget is ₦120,000."
        })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.persisted).toBe(true);
    expect(body.mission.id).toMatch(/^mission-/);
    expect(repositoryMocks.saveMissionSnapshot).toHaveBeenCalledTimes(1);
  });

  it("reads a persisted mission by id", async () => {
    const snapshot = buildDemoMissionSnapshot("Find perfume", "mission-read");
    repositoryMocks.getMissionSnapshot.mockResolvedValue(snapshot);

    const response = await getMission(
      new Request("http://sabi.test/api/missions/mission-read"),
      { params: { id: "mission-read" } }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.mission.id).toBe("mission-read");
    expect(body.persisted).toBe(true);
  });

  it("persists the APPROVED mission status without performing a transaction", async () => {
    const snapshot = buildDemoMissionSnapshot(
      "I need 12 bottles of 50ml long-lasting unisex perfume delivered to Yaba tomorrow. My budget is ₦120,000.",
      "mission-approve"
    );
    repositoryMocks.getMissionSnapshot.mockResolvedValue(snapshot);

    const recommendation = snapshot.recommendation;
    expect(recommendation).toBeDefined();

    const response = await approveMission(
      new Request("http://sabi.test/api/missions/mission-approve/approval", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerId: recommendation!.providerId,
          quoteId: recommendation!.quoteId
        })
      }),
      { params: { id: "mission-approve" } }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.missionStatus).toBe("APPROVED");
    expect(body.persisted).toBe(true);
    expect(body.transactionPerformed).toBe(false);
    expect(repositoryMocks.saveMissionSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        mission: expect.objectContaining({ status: "APPROVED" })
      })
    );
  });
});
