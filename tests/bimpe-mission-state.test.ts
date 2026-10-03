import { beforeEach, describe, expect, it, vi } from "vitest";
import { communicationResultSchema } from "../lib/schemas";
import { buildDemoMissionSnapshot } from "../lib/mission/demo-engine";

const repositoryMocks = vi.hoisted(() => ({
  getMissionSnapshot: vi.fn()
}));

vi.mock("../lib/integrations/neon/mission-snapshot-repository", () => ({
  getMissionSnapshot: repositoryMocks.getMissionSnapshot
}));

import { getMissionStateForAgent } from "../lib/integrations/bimpe/mission-state";

describe("Bimpe mission state recovery", () => {
  beforeEach(() => {
    repositoryMocks.getMissionSnapshot.mockReset();
  });

  it("returns all persisted communication IDs so Bimpe does not rely on chat memory", async () => {
    const snapshot = buildDemoMissionSnapshot("Find perfume", "mission-state-test");
    const first = communicationResultSchema.parse({
      id: "communication-first",
      missionId: snapshot.mission.id,
      providerId: snapshot.providers[0].id,
      channel: "CALL",
      status: "COMPLETED",
      externalId: "call-first",
      occurredAt: "2026-10-03T01:00:00.000Z"
    });
    const second = communicationResultSchema.parse({
      id: "communication-second",
      missionId: snapshot.mission.id,
      providerId: snapshot.providers[0].id,
      channel: "CALL",
      status: "INITIATED",
      externalId: "call-second",
      occurredAt: "2026-10-03T01:05:00.000Z"
    });

    repositoryMocks.getMissionSnapshot.mockResolvedValue({
      ...snapshot,
      communications: [first, second]
    });

    const state = await getMissionStateForAgent({ missionId: snapshot.mission.id });

    expect(state.communications.map((communication) => communication.id)).toEqual([
      "communication-first",
      "communication-second"
    ]);
    expect(state.latestCommunicationId).toBe("communication-second");
  });

  it("fails closed for an unknown mission", async () => {
    repositoryMocks.getMissionSnapshot.mockResolvedValue(undefined);

    await expect(
      getMissionStateForAgent({ missionId: "mission-missing" })
    ).rejects.toThrow("MISSION_NOT_FOUND");
  });
});
