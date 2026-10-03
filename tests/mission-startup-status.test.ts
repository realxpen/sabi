import { describe, expect, it } from "vitest";
import { buildInitialMissionSnapshot } from "../lib/mission/initial-snapshot";
import { getMissionStartupIssue, STARTUP_STALL_MS, BIMPE_HANDOFF_STEP } from "../lib/mission/startup-status";

const snapshot = buildInitialMissionSnapshot("Find a caterer under ₦45,000", "mission-startup", false);
const created = Date.parse(snapshot.mission.createdAt);

describe("truthful mission startup status", () => {
  it("explains missing configuration on previously saved stuck missions", () => {
    expect(getMissionStartupIssue(snapshot, false)?.code).toBe("AGENT_NOT_CONFIGURED");
  });
  it("shows a delay after 90 seconds without claiming failure or replaying a request", () => {
    expect(getMissionStartupIssue(snapshot, true, created + 1000)).toBeNull();
    expect(getMissionStartupIssue(snapshot, true, created + STARTUP_STALL_MS)?.code).toBe("AGENT_START_DELAYED");
  });
  it("shows a persisted handoff failure immediately", () => {
    expect(getMissionStartupIssue({ ...snapshot, steps: [{
      id: "handoff", missionId: snapshot.mission.id, type: BIMPE_HANDOFF_STEP,
      status: "FAILED", message: "Connection failed", createdAt: snapshot.mission.createdAt
    }] }, true, created)?.code).toBe("AGENT_HANDOFF_FAILED");
  });
  it("does not call simulation, progressed or cancelled missions stuck at startup", () => {
    expect(getMissionStartupIssue({ ...snapshot, demoMode: true }, false)).toBeNull();
    for (const status of ["SEARCHING", "CONTACTING", "CANCELLED", "APPROVED"] as const) {
      expect(getMissionStartupIssue({ ...snapshot, mission: { ...snapshot.mission, status } }, false)).toBeNull();
    }
  });
});
