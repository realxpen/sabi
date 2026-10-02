import { describe, expect, it } from "vitest";
import { buildDemoMissionSnapshot } from "../lib/mission/demo-engine";
import { buildIntegratedMissionSnapshot } from "../lib/mission/integration-snapshot";

describe("buildIntegratedMissionSnapshot", () => {
  it("assembles teammate outputs into a non-demo Mission Control snapshot", () => {
    const demo = buildDemoMissionSnapshot(
      "I need 12 bottles of 50ml long-lasting unisex perfume delivered to Yaba tomorrow. My budget is ₦120,000.",
      "mission-integration"
    );

    const integrated = buildIntegratedMissionSnapshot({
      mission: demo.mission,
      steps: demo.steps,
      providers: demo.providers,
      communications: demo.communications,
      quotes: demo.quotes,
      recommendation: demo.recommendation
    });

    expect(integrated.demoMode).toBe(false);
    expect(integrated.communications).toHaveLength(3);
    expect(integrated.recommendation?.providerId).toBe(
      "provider-scenthub-yaba"
    );
  });

  it("rejects communication results from a different mission", () => {
    const demo = buildDemoMissionSnapshot(
      "I need 12 bottles of 50ml perfume delivered to Yaba tomorrow. My budget is ₦120,000.",
      "mission-integration"
    );

    expect(() =>
      buildIntegratedMissionSnapshot({
        mission: demo.mission,
        steps: demo.steps,
        providers: demo.providers,
        communications: demo.communications.map((result, index) =>
          index === 0
            ? { ...result, missionId: "different-mission" }
            : result
        ),
        quotes: demo.quotes,
        recommendation: demo.recommendation
      })
    ).toThrow("COMMUNICATION_MISSION_MISMATCH");
  });
});
