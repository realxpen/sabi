import { describe, expect, it } from "vitest";
import { buildDemoMissionSnapshot } from "../lib/mission/demo-engine";

describe("buildDemoMissionSnapshot", () => {
  it("keeps the canonical Ankara mission in comparison while capacity is unknown", () => {
    const snapshot = buildDemoMissionSnapshot(
      "I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.",
      "mission-demo"
    );

    expect(snapshot.demoMode).toBe(true);
    expect(snapshot.mission.status).toBe("COMPARING");
    expect(snapshot.steps.at(-1)?.status).toBe("RUNNING");
    expect(snapshot.steps.at(-1)?.message).toContain("20 yards");
    expect(snapshot.recommendation).toBeUndefined();
    expect(snapshot.quotes).toHaveLength(7);
    expect(
      snapshot.quotes.some(
        (quote) => quote.sourceReference === "demo-call-bola-late"
      )
    ).toBe(true);
  });

  it("reaches human approval when all represented hard constraints are verified", () => {
    const snapshot = buildDemoMissionSnapshot(
      "I need black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.",
      "mission-no-quantity"
    );

    expect(snapshot.mission.status).toBe("AWAITING_APPROVAL");
    expect(snapshot.steps.at(-1)?.status).toBe("RUNNING");
    expect(snapshot.recommendation?.providerId).toBe(
      "provider-ade-textiles"
    );
    expect(snapshot.recommendation?.quoteId).toBe("quote-ade-textiles");
  });

  it("does not recommend an option when the hard demo budget excludes all totals", () => {
    const snapshot = buildDemoMissionSnapshot(
      "I need black Ankara delivered to Yaba tomorrow. My budget is ₦50,000.",
      "mission-tight-budget"
    );

    expect(snapshot.mission.status).toBe("COMPARING");
    expect(snapshot.recommendation).toBeUndefined();
  });
});
