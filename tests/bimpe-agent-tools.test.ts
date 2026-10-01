import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemoMissionSnapshot } from "../lib/mission/demo-engine";
import { buildTemporaryDemoQuotes } from "../lib/demo/temporary-scenario";

const repositoryMocks = vi.hoisted(() => ({
  current: undefined as unknown,
  getMissionSnapshot: vi.fn(),
  saveMissionSnapshot: vi.fn()
}));

vi.mock("../lib/integrations/neon/mission-snapshot-repository", () => ({
  getMissionSnapshot: repositoryMocks.getMissionSnapshot,
  saveMissionSnapshot: repositoryMocks.saveMissionSnapshot
}));

import {
  recordQuoteForAgent,
  requestHumanApprovalForAgent,
  searchProvidersForAgent
} from "../lib/integrations/bimpe/tools";

describe("Bimpe-facing SABI tools", () => {
  beforeEach(() => {
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

  it("returns explicit simulation providers but refuses to fake a live directory", () => {
    const providers = searchProvidersForAgent({ mode: "SIMULATION", category: "Fabric" });
    expect(providers.length).toBeGreaterThan(0);

    expect(() => searchProvidersForAgent({ mode: "LIVE" })).toThrow(
      "LIVE_PROVIDER_DIRECTORY_NOT_CONFIGURED"
    );
  });

  it("persists only source-referenced Quotes for known providers", async () => {
    const snapshot = buildDemoMissionSnapshot(
      "I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.",
      "mission-tools"
    );
    repositoryMocks.current = { ...snapshot, quotes: [] };

    const quote = buildTemporaryDemoQuotes(snapshot.mission)[0];
    const updated = await recordQuoteForAgent({ quote });

    expect(updated.quotes).toHaveLength(1);
    expect(updated.quotes[0].sourceReference).toBe("phase1-mock-scenario");
  });

  it("requests human approval without approving or transacting", async () => {
    const snapshot = buildDemoMissionSnapshot(
      "I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.",
      "mission-approval-tool"
    );
    repositoryMocks.current = {
      ...snapshot,
      mission: { ...snapshot.mission, status: "COMPARING" }
    };

    const updated = await requestHumanApprovalForAgent("mission-approval-tool");

    expect(updated.mission.status).toBe("AWAITING_APPROVAL");
    expect(updated.recommendation).toBeDefined();
    expect(repositoryMocks.saveMissionSnapshot).toHaveBeenCalledTimes(1);
  });
});
