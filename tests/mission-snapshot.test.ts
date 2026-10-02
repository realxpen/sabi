import { describe, expect, it } from "vitest";
import { buildDemoMissionSnapshot } from "../lib/mission/demo-engine";
import { missionSnapshotSchema } from "../lib/mission/snapshot";

describe("missionSnapshotSchema", () => {
  it("accepts the canonical mission snapshot before persistence", () => {
    const snapshot = buildDemoMissionSnapshot(
      "I need 12 bottles of 50ml long-lasting unisex perfume delivered to Yaba tomorrow. My budget is ₦120,000.",
      "mission-persisted"
    );

    const parsed = missionSnapshotSchema.parse(snapshot);

    expect(parsed.mission.id).toBe("mission-persisted");
    expect(parsed.communications).toHaveLength(3);
    expect(parsed.recommendation?.quoteId).toBe("quote-scenthub-yaba");
  });

  it("rejects malformed persisted state before it reaches Mission Control", () => {
    expect(() =>
      missionSnapshotSchema.parse({
        mission: { id: "broken" },
        steps: [],
        providers: [],
        communications: [],
        quotes: [],
        demoMode: false
      })
    ).toThrow();
  });
});
