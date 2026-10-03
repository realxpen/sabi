import { describe, expect, it } from "vitest";
import { providerSchema } from "../lib/schemas";
import {
  registeredProviderCategoryMatches,
  registeredProviderLocationMatches,
  registeredProviderMatchesFilters
} from "../lib/integrations/neon/provider-registry";

const cateringProvider = providerSchema.parse({
  id: "provider-test-catering",
  name: "Demo Catering Business",
  category: "Catering",
  location: "Yaba, Lagos",
  languages: ["English"],
  verified: false,
  active: true
});

describe("registered provider discovery", () => {
  it("matches a neighborhood query against a richer saved location", () => {
    expect(registeredProviderLocationMatches("Yaba, Lagos", "Yaba")).toBe(true);
    expect(registeredProviderLocationMatches("Yaba, Lagos", "Lagos")).toBe(true);
    expect(registeredProviderLocationMatches("Yaba, Lagos", "Ikeja")).toBe(false);
  });

  it("treats equivalent provider-category wording as the same intent", () => {
    expect(registeredProviderCategoryMatches("Catering", "caterer")).toBe(true);
    expect(registeredProviderCategoryMatches("Catering", "food")).toBe(true);
    expect(registeredProviderCategoryMatches("Catering", "photographer")).toBe(false);
  });

  it("allows Bimpe to search a real vendor without exact-string coupling", () => {
    expect(
      registeredProviderMatchesFilters(cateringProvider, {
        category: "caterer",
        location: "Yaba",
        active: true
      })
    ).toBe(true);

    expect(
      registeredProviderMatchesFilters(cateringProvider, {
        category: "photography",
        location: "Yaba",
        active: true
      })
    ).toBe(false);
  });
});
