import { describe, expect, it } from "vitest";
import { providerMatchesMissionItem } from "../lib/intelligence/constraints";
import { parseDemoMissionRequest } from "../lib/mission/demo-parser";

const mission = parseDemoMissionRequest("I need 10 packs of jollof rice with chicken delivered to Yaba tomorrow. My budget is ₦45,000.");
const provider = {
  id: "provider-xpen", name: "Xpen Catering", category: "Catering",
  location: "Yaba, Lagos", languages: ["English"], verified: false, active: true
};

describe("catering discovery and comparison", () => {
  it("matches the registered catering business to a meal request", () => {
    expect(providerMatchesMissionItem(mission, provider)).toBe(true);
  });
  it("does not match unrelated providers or the word price", () => {
    expect(providerMatchesMissionItem(mission, { ...provider, category: "Plumbing" })).toBe(false);
    expect(providerMatchesMissionItem({ ...mission, item: "low price perfume" }, provider)).toBe(false);
  });
});
