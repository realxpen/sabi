import { describe, expect, it } from "vitest";
import { approveDemoRecommendation } from "../lib/approval/demo-approval";
import { buildDemoMissionSnapshot } from "../lib/mission/demo-engine";

describe("approveDemoRecommendation", () => {
  it("records human approval without performing a transaction", () => {
    const snapshot = buildDemoMissionSnapshot(
      "I need 12 bottles of 50ml long-lasting unisex perfume delivered to Yaba tomorrow. My budget is ₦120,000.",
      "mission-approval"
    );

    const result = approveDemoRecommendation(snapshot);

    expect(result.approval.status).toBe("APPROVED");
    expect(result.mission.status).toBe("APPROVED");
    expect(result.transactionPerformed).toBe(false);
  });

  it("cannot approve when no qualifying recommendation exists", () => {
    const snapshot = buildDemoMissionSnapshot(
      "I need 12 bottles of 50ml perfume delivered to Yaba tomorrow. My budget is ₦90,000.",
      "mission-no-recommendation"
    );

    expect(() => approveDemoRecommendation(snapshot)).toThrow(
      "No recommendation is available to approve."
    );
  });
});
