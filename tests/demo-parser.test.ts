import { describe, expect, it } from "vitest";
import { parseDemoMissionRequest } from "../lib/mission/demo-parser";

describe("parseDemoMissionRequest", () => {
  it("extracts the canonical perfume mission", () => {
    const mission = parseDemoMissionRequest(
      "I need 12 bottles of 50ml perfume delivered to Yaba tomorrow. My budget is N120,000.",
      "mission-test"
    );

    expect(mission.item.toLowerCase()).toBe("50ml perfume");
    expect(mission.quantity).toBe(12);
    expect(mission.unit).toBe("bottles");
    expect(mission.budget).toBe(120000);
    expect(mission.location).toBe("Yaba");
    expect(mission.deadline).toBe("tomorrow");
    expect(mission.approvalRequired).toBe(true);
  });

  it("leaves unavailable constraints unknown instead of inventing them", () => {
    const mission = parseDemoMissionRequest(
      "I need perfume",
      "mission-unknowns"
    );

    expect(mission.budget).toBeUndefined();
    expect(mission.location).toBeUndefined();
    expect(mission.deadline).toBeUndefined();
  });
});
