import { describe, expect, it } from "vitest";
import { searchProviders } from "../lib/tools/provider-tools";

describe("searchProviders", () => {
  it("returns active demo providers when no filters are supplied", () => {
    const providers = searchProviders({});

    expect(providers).toHaveLength(3);
    expect(providers.every((provider) => provider.active)).toBe(true);
  });

  it("filters providers by location", () => {
    const providers = searchProviders({ location: "Yaba" });

    expect(providers).toHaveLength(1);
    expect(providers[0].id).toBe("provider-tola-fabrics");
  });

  it("filters providers by language", () => {
    const providers = searchProviders({ language: "Yoruba" });

    expect(providers.map((provider) => provider.id)).toEqual([
      "provider-tola-fabrics",
      "provider-mariam-fabrics"
    ]);
  });

  it("filters providers by verified status", () => {
    const providers = searchProviders({ verified: true });

    expect(providers.map((provider) => provider.id)).toEqual([
      "provider-ade-textiles",
      "provider-tola-fabrics"
    ]);
  });

  it("matches a free-text query across provider fields", () => {
    const providers = searchProviders({ query: "textiles" });

    expect(providers).toHaveLength(1);
    expect(providers[0].id).toBe("provider-ade-textiles");
  });
});
