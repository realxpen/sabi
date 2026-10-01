import { describe, expect, it } from "vitest";
import { missionSchema } from "../lib/schemas";
import {
  discoverLiveTestProvidersForMission,
  readLiveTestProviders,
  searchLiveTestProviders
} from "../lib/integrations/providers/live-test-directory";

const providerDirectory = JSON.stringify([
  {
    id: "provider-consented-fabric",
    name: "Consented Fabric Test Provider",
    category: "Fabric",
    location: "Lagos",
    languages: ["English", "Yoruba"],
    verified: false,
    active: true
  },
  {
    id: "provider-consented-plumber",
    name: "Consented Plumbing Test Provider",
    category: "Plumbing",
    location: "Lagos",
    languages: ["English"],
    verified: false,
    active: true
  }
]);

const mission = missionSchema.parse({
  id: "mission-live-directory",
  type: "PROCUREMENT",
  status: "PLANNING",
  rawRequest: "I need 20 yards of black Ankara delivered tomorrow.",
  item: "Black Ankara fabric",
  quantity: 20,
  unit: "yards",
  budget: 70000,
  location: "Yaba",
  deadline: "tomorrow",
  approvalRequired: true,
  createdAt: "2026-10-01T21:00:00.000Z"
});

describe("live test provider directory", () => {
  it("returns undefined when no live provider metadata is configured", () => {
    expect(readLiveTestProviders({})).toBeUndefined();
    expect(searchLiveTestProviders({}, {})).toBeUndefined();
  });

  it("returns canonical provider metadata without dialing numbers", () => {
    const providers = readLiveTestProviders({
      SABI_LIVE_TEST_PROVIDERS_JSON: providerDirectory
    });

    expect(providers).toHaveLength(2);
    expect(providers?.[0].phone).toBeUndefined();
  });

  it("rejects phone numbers inside the metadata directory", () => {
    const invalid = JSON.stringify([
      {
        id: "provider-with-phone",
        name: "Provider With Phone",
        category: "Fabric",
        phone: "+2348000000000",
        location: "Lagos",
        languages: ["English"],
        verified: false,
        active: true
      }
    ]);

    expect(() =>
      readLiveTestProviders({ SABI_LIVE_TEST_PROVIDERS_JSON: invalid })
    ).toThrow(
      "SABI_LIVE_TEST_PROVIDERS_JSON must be an array of canonical provider metadata without phone numbers."
    );
  });

  it("discovers only active providers that match the Mission item", () => {
    const providers = discoverLiveTestProvidersForMission(mission, {
      SABI_LIVE_TEST_PROVIDERS_JSON: providerDirectory
    });

    expect(providers?.map((provider) => provider.id)).toEqual([
      "provider-consented-fabric"
    ]);
  });
});
