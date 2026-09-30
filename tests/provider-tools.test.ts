import { describe, expect, it } from "vitest";
import { callProvider, getProvider, searchProviders } from "../lib/tools/provider-tools";

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


describe("getProvider", () => {
  it("returns a validated provider by canonical ID", () => {
    const provider = getProvider("provider-tola-fabrics");

    expect(provider?.name).toBe("Tola Fabrics (Demo)");
    expect(provider?.location).toBe("Yaba");
  });

  it("returns undefined for an unknown provider ID", () => {
    expect(getProvider("provider-missing")).toBeUndefined();
  });
});

describe("callProvider", () => {
  it("uses the communication adapter boundary without claiming a real call", async () => {
    const result = await callProvider({
      missionId: "mission-demo",
      providerId: "provider-tola-fabrics",
      objective: "Confirm current availability and price."
    });

    expect(result.providerId).toBe("provider-tola-fabrics");
    expect(result.status).toBe("INITIATED");
    expect(result.channel).toBe("MOCK");
    expect(result.summary).toContain("No real provider was contacted");
  });

  it("rejects an unknown provider", async () => {
    await expect(
      callProvider({
        missionId: "mission-demo",
        providerId: "provider-missing",
        objective: "Confirm current availability."
      })
    ).rejects.toThrow("Provider not found");
  });
});
