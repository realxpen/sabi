import { describe, expect, it } from "vitest";
import {
  applyHumanConfirmedBudgetUpdate,
  updateMissionConstraintsToolInputSchema
} from "../lib/integrations/bimpe/mission-constraints";
import type { MissionSnapshot } from "../lib/mission/snapshot";

function snapshot(status: MissionSnapshot["mission"]["status"] = "COMPARING"): MissionSnapshot {
  return {
    mission: {
      id: "mission-demo",
      type: "PROCUREMENT",
      status,
      rawRequest: "Find perfume under ₦120,000",
      item: "perfume",
      budget: 120000,
      approvalRequired: true,
      createdAt: "2026-10-03T00:00:00.000Z"
    },
    steps: [],
    providers: [],
    communications: [],
    quotes: [],
    recommendation: {
      providerId: "provider-demo",
      quoteId: "quote-demo",
      reasons: ["stale recommendation"]
    },
    demoMode: false
  };
}

describe("Bimpe mission constraint update", () => {
  it("normalizes quoted Bimpe scalars and applies a human-confirmed budget update", () => {
    const input = updateMissionConstraintsToolInputSchema.parse({
      missionId: "mission-demo",
      budget: "123000",
      humanConfirmed: "true"
    });

    expect(input.budget).toBe(123000);
    expect(input.humanConfirmed).toBe(true);

    const result = applyHumanConfirmedBudgetUpdate(snapshot(), input);

    expect(result.changed).toBe(true);
    expect(result.previousBudget).toBe(120000);
    expect(result.snapshot.mission.budget).toBe(123000);
    expect(result.snapshot.mission.status).toBe("COMPARING");
    expect(result.snapshot.recommendation).toBeUndefined();
    expect(result.snapshot.steps.at(-1)?.type).toBe("UPDATE_CONSTRAINTS");
  });

  it("requires explicit human confirmation", () => {
    expect(() =>
      updateMissionConstraintsToolInputSchema.parse({
        missionId: "mission-demo",
        budget: "123000",
        humanConfirmed: "false"
      })
    ).toThrow();
  });

  it("rejects constraint updates outside COMPARING", () => {
    const input = updateMissionConstraintsToolInputSchema.parse({
      missionId: "mission-demo",
      budget: "123000",
      humanConfirmed: "true"
    });

    expect(() => applyHumanConfirmedBudgetUpdate(snapshot("CONTACTING"), input)).toThrow(
      "MISSION_NOT_READY_FOR_CONSTRAINT_UPDATE"
    );
  });
});
