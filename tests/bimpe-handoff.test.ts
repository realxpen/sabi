import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildInitialMissionSnapshot } from "../lib/mission/initial-snapshot";

vi.mock("../lib/integrations/bimpe/conversation-orchestrator", () => ({ startBimpeMissionOrchestration: vi.fn() }));
vi.mock("../lib/integrations/neon/mission-snapshot-repository", () => ({ updateMissionStep: vi.fn() }));
import { startBimpeMissionOrchestration } from "../lib/integrations/bimpe/conversation-orchestrator";
import { updateMissionStep } from "../lib/integrations/neon/mission-snapshot-repository";
import { buildBimpeHandoffStep, dispatchBimpeMissionStart } from "../lib/mission/bimpe-handoff";

describe("persisted Bimpe handoff", () => {
  beforeEach(() => vi.resetAllMocks());

  const snapshot = buildInitialMissionSnapshot("Find food under ₦45,000", "mission-handoff", false);
  snapshot.steps.push(buildBimpeHandoffStep(snapshot.mission.id));

  it("records acceptance without claiming that Bimpe advanced the mission", async () => {
    await dispatchBimpeMissionStart(snapshot);
    expect(updateMissionStep).toHaveBeenCalledWith(expect.objectContaining({ status: "COMPLETED" }));
    expect(snapshot.mission.status).toBe("CREATED");
  });

  it("persists failure without retrying a potentially accepted request", async () => {
    vi.mocked(startBimpeMissionOrchestration).mockRejectedValue(new Error("HTTP 401"));
    await dispatchBimpeMissionStart(snapshot);
    expect(updateMissionStep).toHaveBeenCalledWith(expect.objectContaining({ status: "FAILED" }));
    expect(startBimpeMissionOrchestration).toHaveBeenCalledTimes(1);
  });
});
