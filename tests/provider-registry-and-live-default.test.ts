import { describe, expect, it } from "vitest";
import {
  createRegisteredProviderInputSchema,
  normalizeProviderPhone
} from "../lib/integrations/neon/provider-registry";
import { readDefaultMissionExecutionMode } from "../lib/mission/create-mission";

describe("provider registry onboarding", () => {
  it("normalizes Nigerian local mobile numbers to E.164", () => {
    expect(normalizeProviderPhone("0801 234 5678")).toBe("+2348012345678");
  });

  it("preserves an already-valid E.164 number", () => {
    expect(normalizeProviderPhone("+2348012345678")).toBe("+2348012345678");
  });

  it("requires explicit live-contact consent", () => {
    expect(() =>
      createRegisteredProviderInputSchema.parse({
        name: "Test Vendor",
        category: "Perfume",
        location: "Lagos",
        phone: "08012345678",
        languages: ["English"],
        consentedToLiveContact: false
      })
    ).toThrow();
  });
});

describe("consumer mission execution default", () => {
  it("defaults unspecified missions to LIVE", () => {
    expect(readDefaultMissionExecutionMode({})).toBe("LIVE");
  });

  it("still allows an explicit simulation environment override", () => {
    expect(
      readDefaultMissionExecutionMode({ SABI_DEFAULT_MISSION_MODE: "SIMULATION" })
    ).toBe("SIMULATION");
  });
});
