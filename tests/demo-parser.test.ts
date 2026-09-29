import { describe, expect, it } from "vitest";
import { parseDemoMissionRequest } from "../lib/mission/demo-parser";

describe("parseDemoMissionRequest", () => {
  it("extracts the canonical Ankara mission", () => {
    const mission = parseDemoMissionRequest(
      "I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.",
      "mission-test"
    );

    expect(mission.item.toLowerCase()).toBe("black ankara");
    expect(mission.quantity).toBe(20);
    expect(mission.unit).toBe("yards");
    expect(mission.budget).toBe(70000);
    expect(mission.location).toBe("Yaba");
    expect(mission.deadline).toBe("tomorrow");
    expect(mission.approvalRequired).toBe(true);
  });

  it("leaves unavailable constraints unknown instead of inventing them", () => {
    const mission = parseDemoMissionRequest(
      "I need some Ankara",
      "mission-unknowns"
    );

    expect(mission.budget).toBeUndefined();
    expect(mission.location).toBeUndefined();
    expect(mission.deadline).toBeUndefined();
  });
});
