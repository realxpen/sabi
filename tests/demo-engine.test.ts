import { describe, expect, it } from "vitest";
import { buildDemoMissionSnapshot } from "../lib/mission/demo-engine";

describe("buildDemoMissionSnapshot", () => {
  it("reaches the human approval checkpoint with explicit mock data", () => {
    const snapshot = buildDemoMissionSnapshot(
      "I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.",
      "mission-demo"
    );

    expect(snapshot.demoMode).toBe(true);
    expect(snapshot.mission.status).toBe("AWAITING_APPROVAL");
    expect(snapshot.steps.at(-1)?.status).toBe("RUNNING");
    expect(snapshot.recommendation?.providerId).toBe(
      "provider-ade-textiles"
    );
    expect(snapshot.quotes).toHaveLength(3);
    expect(
      snapshot.quotes.every(
        (quote) => quote.sourceReference === "phase1-mock-scenario"
      )
    ).toBe(true);
  });

  it("does not recommend an option when the hard demo budget excludes all totals", () => {
    const snapshot = buildDemoMissionSnapshot(
      "I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦50,000.",
      "mission-tight-budget"
    );

    expect(snapshot.recommendation).toBeUndefined();
  });
});
