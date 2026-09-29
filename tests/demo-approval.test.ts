import { describe, expect, it } from "vitest";
import { approveDemoRecommendation } from "../lib/approval/demo-approval";
import { buildDemoMissionSnapshot } from "../lib/mission/demo-engine";

describe("approveDemoRecommendation", () => {
  it("records human approval without performing a transaction", () => {
    const snapshot = buildDemoMissionSnapshot(
      "I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.",
      "mission-approval"
    );

    const result = approveDemoRecommendation(snapshot);

    expect(result.approval.status).toBe("APPROVED");
    expect(result.mission.status).toBe("APPROVED");
    expect(result.transactionPerformed).toBe(false);
  });

  it("cannot approve when no qualifying recommendation exists", () => {
    const snapshot = buildDemoMissionSnapshot(
      "I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦50,000.",
      "mission-no-recommendation"
    );

    expect(() => approveDemoRecommendation(snapshot)).toThrow(
      "No recommendation is available to approve."
    );
  });
});
