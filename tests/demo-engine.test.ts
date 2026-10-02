import { describe, expect, it } from "vitest";
import { buildDemoMissionSnapshot } from "../lib/mission/demo-engine";

describe("buildDemoMissionSnapshot", () => {
  it("reaches the human approval checkpoint with explicit perfume mock data", () => {
    const snapshot = buildDemoMissionSnapshot(
      "I need 12 bottles of 50ml long-lasting unisex perfume delivered to Yaba tomorrow. My budget is ₦120,000.",
      "mission-demo"
    );

    expect(snapshot.demoMode).toBe(true);
    expect(snapshot.mission.status).toBe("AWAITING_APPROVAL");
    expect(snapshot.steps.at(-1)?.status).toBe("RUNNING");
    expect(snapshot.recommendation?.providerId).toBe(
      "provider-scenthub-yaba"
    );
    expect(snapshot.quotes).toHaveLength(3);
    expect(snapshot.communications).toHaveLength(snapshot.quotes.length);
    expect(
      snapshot.communications.every(
        (result) => result.channel === "MOCK" && result.status === "COMPLETED"
      )
    ).toBe(true);
    expect(
      snapshot.quotes.every(
        (quote) => quote.sourceReference === "hackathon-perfume-simulation"
      )
    ).toBe(true);
  });

  it("does not recommend an option when the hard demo budget excludes all totals", () => {
    const snapshot = buildDemoMissionSnapshot(
      "I need 12 bottles of 50ml perfume delivered to Yaba tomorrow. My budget is ₦90,000.",
      "mission-tight-budget"
    );

    expect(snapshot.recommendation).toBeUndefined();
  });
});
