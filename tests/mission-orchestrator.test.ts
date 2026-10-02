import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildInitialMissionSnapshot } from "../lib/mission/initial-snapshot";

const repositoryMocks = vi.hoisted(() => ({
  current: undefined as unknown,
  getMissionSnapshot: vi.fn(),
  saveMissionSnapshot: vi.fn()
}));

vi.mock("../lib/integrations/neon/mission-snapshot-repository", () => ({
  getMissionSnapshot: repositoryMocks.getMissionSnapshot,
  saveMissionSnapshot: repositoryMocks.saveMissionSnapshot
}));

import { advanceMissionOrchestration } from "../lib/mission/orchestrator";

describe("mission orchestrator", () => {
  beforeEach(() => {
    delete process.env.SABI_LIVE_TEST_PROVIDERS_JSON;

    repositoryMocks.current = buildInitialMissionSnapshot(
      "I need 12 bottles of 50ml long-lasting unisex perfume delivered to Yaba tomorrow. My budget is ₦120,000.",
      "mission-orchestrator",
      true
    );

    repositoryMocks.getMissionSnapshot.mockReset();
    repositoryMocks.saveMissionSnapshot.mockReset();
    repositoryMocks.getMissionSnapshot.mockImplementation(async () =>
      repositoryMocks.current
    );
    repositoryMocks.saveMissionSnapshot.mockImplementation(async (snapshot) => {
      repositoryMocks.current = snapshot;
      return snapshot;
    });
  });

  afterEach(() => {
    delete process.env.SABI_LIVE_TEST_PROVIDERS_JSON;
  });

  it("advances a clearly labelled simulation to the human approval checkpoint", async () => {
    let result;

    for (let index = 0; index < 7; index += 1) {
      result = await advanceMissionOrchestration("mission-orchestrator", {
        mode: "SIMULATION"
      });
    }

    expect(result?.snapshot.mission.status).toBe("AWAITING_APPROVAL");
    expect(result?.outcome).toBe("CHECKPOINT");
    expect(result?.snapshot.providers.length).toBeGreaterThan(0);
    expect(result?.snapshot.communications).toHaveLength(3);
    expect(
      result?.snapshot.communications.every(
        (communication) => communication.channel === "MOCK"
      )
    ).toBe(true);
    expect(result?.snapshot.quotes).toHaveLength(3);
    expect(
      result?.snapshot.quotes.every(
        (quote) => quote.sourceReference === "hackathon-perfume-simulation"
      )
    ).toBe(true);
    expect(result?.snapshot.recommendation?.providerId).toBe(
      "provider-scenthub-yaba"
    );
  });

  it("never borrows simulation providers when a live mission has none", async () => {
    repositoryMocks.current = buildInitialMissionSnapshot(
      "I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.",
      "mission-live",
      false
    );

    await advanceMissionOrchestration("mission-live", { mode: "LIVE" });
    await advanceMissionOrchestration("mission-live", { mode: "LIVE" });
    const searching = await advanceMissionOrchestration("mission-live", {
      mode: "LIVE"
    });

    expect(searching.snapshot.mission.status).toBe("SEARCHING");
    expect(searching.outcome).toBe("WAITING");
    expect(searching.reason).toBe("WAITING_FOR_PROVIDER_DISCOVERY");
    expect(searching.snapshot.providers).toEqual([]);
    expect(searching.snapshot.communications).toEqual([]);
    expect(searching.snapshot.quotes).toEqual([]);
  });

  it("discovers only configured matching providers for a live mission", async () => {
    repositoryMocks.current = buildInitialMissionSnapshot(
      "I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.",
      "mission-live-configured",
      false
    );

    process.env.SABI_LIVE_TEST_PROVIDERS_JSON = JSON.stringify([
      {
        id: "provider-consented-fabric",
        name: "Consented Fabric Test Provider",
        category: "Fabric",
        location: "Lagos",
        languages: ["English"],
        verified: false,
        active: true
      },
      {
        id: "provider-unrelated-plumber",
        name: "Unrelated Plumbing Provider",
        category: "Plumbing",
        location: "Lagos",
        languages: ["English"],
        verified: false,
        active: true
      }
    ]);

    await advanceMissionOrchestration("mission-live-configured", { mode: "LIVE" });
    await advanceMissionOrchestration("mission-live-configured", { mode: "LIVE" });
    const searching = await advanceMissionOrchestration(
      "mission-live-configured",
      { mode: "LIVE" }
    );

    expect(searching.snapshot.mission.status).toBe("SEARCHING");
    expect(searching.outcome).toBe("ADVANCED");
    expect(searching.snapshot.providers.map((provider) => provider.id)).toEqual([
      "provider-consented-fabric"
    ]);
    expect(searching.snapshot.communications).toEqual([]);
    expect(searching.snapshot.quotes).toEqual([]);
  });

  it("refuses simulation against a mission marked for live operation", async () => {
    repositoryMocks.current = buildInitialMissionSnapshot(
      "Find black Ankara",
      "mission-live",
      false
    );

    await expect(
      advanceMissionOrchestration("mission-live", { mode: "SIMULATION" })
    ).rejects.toThrow("SIMULATION_NOT_ALLOWED_FOR_LIVE_MISSION");
  });
});
