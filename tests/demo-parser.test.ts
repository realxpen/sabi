import { describe, expect, it } from "vitest";
import { parseDemoMissionRequest } from "../lib/mission/demo-parser";

describe("parseDemoMissionRequest", () => {
  it("preserves the full budget when delivery appears between budget and amount", () => {
    const mission = parseDemoMissionRequest(
      "Find a caterer in Yaba, Lagos, for 10 packs of jollof rice with chicken delivered tomorrow, 4 October 2026. My total budget, including delivery, is ₦45,000."
    );
    expect(mission.budget).toBe(45000);
    expect(mission.item).toBe("jollof rice with chicken");
    expect(mission.quantity).toBe(10);
    expect(mission.unit).toBe("packs");
    expect(mission.location).toBe("Yaba");
  });

  it("does not read an n inside a word as a naira budget", () => {
    expect(parseDemoMissionRequest("Find food in 2 hours").budget).toBeUndefined();
  });

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
