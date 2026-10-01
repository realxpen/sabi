import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemoMissionSnapshot } from "../lib/mission/demo-engine";

const repositoryMocks = vi.hoisted(() => ({
  getMissionSnapshot: vi.fn(),
  saveMissionSnapshot: vi.fn()
}));

vi.mock("../lib/integrations/neon/mission-snapshot-repository", () =>
  repositoryMocks
);

import {
  recordCommunicationInMission,
  recordIntelligenceInMission
} from "../lib/mission/persisted-integration";

describe("persisted teammate integration seams", () => {
  beforeEach(() => {
    repositoryMocks.getMissionSnapshot.mockReset();
    repositoryMocks.saveMissionSnapshot.mockReset();
    repositoryMocks.saveMissionSnapshot.mockImplementation(async (snapshot) => snapshot);
  });

  it("updates Lara communication evidence without manufacturing a Quote", async () => {
    const snapshot = buildDemoMissionSnapshot("Find black Ankara", "mission-lara");
    repositoryMocks.getMissionSnapshot.mockResolvedValue(snapshot);

    const original = snapshot.communications[0];
    const result = await recordCommunicationInMission({
      missionId: snapshot.mission.id,
      communication: {
        ...original,
        channel: "CALL",
        status: "NO_ANSWER",
        summary: "Provider did not answer."
      }
    });

    expect(result.communications).toHaveLength(snapshot.communications.length);
    expect(result.communications[0].status).toBe("NO_ANSWER");
    expect(result.quotes).toEqual(snapshot.quotes);
  });

  it("rejects communication evidence for a provider outside the mission", async () => {
    const snapshot = buildDemoMissionSnapshot("Find black Ankara", "mission-lara-bad");
    repositoryMocks.getMissionSnapshot.mockResolvedValue(snapshot);

    await expect(
      recordCommunicationInMission({
        missionId: snapshot.mission.id,
        communication: {
          ...snapshot.communications[0],
          id: "communication-unknown-provider",
          providerId: "provider-not-in-mission"
        }
      })
    ).rejects.toThrow("COMMUNICATION_PROVIDER_MISMATCH");
  });

  it("stores Femi providers, quotes and recommendation as one validated set", async () => {
    const snapshot = buildDemoMissionSnapshot("Find black Ankara", "mission-femi");
    repositoryMocks.getMissionSnapshot.mockResolvedValue(snapshot);

    const result = await recordIntelligenceInMission({
      missionId: snapshot.mission.id,
      providers: snapshot.providers,
      quotes: snapshot.quotes,
      recommendation: snapshot.recommendation
    });

    expect(result.demoMode).toBe(false);
    expect(result.recommendation).toEqual(snapshot.recommendation);
    expect(result.communications).toEqual(snapshot.communications);
  });
});
