import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemoMissionSnapshot } from "../lib/mission/demo-engine";
import { communicationResultSchema } from "../lib/schemas";

const repositoryMocks = vi.hoisted(() => ({
  current: undefined as unknown,
  getMissionSnapshot: vi.fn(),
  saveMissionSnapshot: vi.fn()
}));

vi.mock("../lib/integrations/neon/mission-snapshot-repository", () => ({
  getMissionSnapshot: repositoryMocks.getMissionSnapshot,
  saveMissionSnapshot: repositoryMocks.saveMissionSnapshot
}));

import { recordSupervisedProviderEvidence } from "../lib/mission/supervised-evidence";

function liveCollectionSnapshot(secondStatus: "IN_PROGRESS" | "NO_ANSWER" | "COMPLETED") {
  const base = buildDemoMissionSnapshot(
    "I need 12 bottles of 50ml long-lasting unisex perfume delivered to Yaba tomorrow. My budget is ₦120,000.",
    "mission-supervised"
  );

  const firstProvider = base.providers[0];
  const secondProvider = base.providers[1];

  return {
    ...base,
    demoMode: false,
    mission: { ...base.mission, status: "COLLECTING_QUOTES" as const },
    quotes: [],
    recommendation: undefined,
    communications: [
      communicationResultSchema.parse({
        id: "communication-first",
        missionId: base.mission.id,
        providerId: firstProvider.id,
        channel: "CALL",
        status: "COMPLETED",
        externalId: "vapi-first",
        summary: "Provider completed the call.",
        occurredAt: "2026-10-02T09:00:00.000Z"
      }),
      communicationResultSchema.parse({
        id: "communication-second",
        missionId: base.mission.id,
        providerId: secondProvider.id,
        channel: "CALL",
        status: secondStatus,
        externalId: "vapi-second",
        summary:
          secondStatus === "NO_ANSWER"
            ? "Provider did not answer."
            : "Second provider contact state.",
        occurredAt: "2026-10-02T09:01:00.000Z"
      })
    ]
  };
}

describe("supervised evidence runtime", () => {
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

  it("records a source-traceable Quote but waits while another provider contact is active", async () => {
    repositoryMocks.current = liveCollectionSnapshot("IN_PROGRESS");

    const result = await recordSupervisedProviderEvidence({
      missionId: "mission-supervised",
      communicationId: "communication-first",
      available: true,
      price: 96000,
      deliveryFee: 5000,
      total: 101000,
      deliveryDate: "tomorrow"
    });

    expect(result.quote.sourceReference).toBe("vapi-first");
    expect(result.snapshot.quotes).toHaveLength(1);
    expect(result.snapshot.mission.status).toBe("COLLECTING_QUOTES");
    expect(result.allProviderContactsSettled).toBe(false);
    expect(result.consequentialActionPerformed).toBe(false);
  });

  it("continues to deterministic recommendation only after all provider contacts settle", async () => {
    repositoryMocks.current = liveCollectionSnapshot("NO_ANSWER");

    const result = await recordSupervisedProviderEvidence({
      missionId: "mission-supervised",
      communicationId: "communication-first",
      available: true,
      price: 96000,
      deliveryFee: 5000,
      total: 101000,
      deliveryDate: "tomorrow"
    });

    expect(result.snapshot.mission.status).toBe("AWAITING_APPROVAL");
    expect(result.snapshot.recommendation?.providerId).toBe(
      result.snapshot.providers[0].id
    );
    expect(result.snapshot.quotes).toHaveLength(1);
    expect(result.allProviderContactsSettled).toBe(true);
    expect(result.completedEvidencePending).toBe(false);
    expect(result.consequentialActionPerformed).toBe(false);
  });

  it("waits when another completed communication still needs factual evidence", async () => {
    repositoryMocks.current = liveCollectionSnapshot("COMPLETED");

    const result = await recordSupervisedProviderEvidence({
      missionId: "mission-supervised",
      communicationId: "communication-first",
      available: true,
      total: 101000,
      deliveryDate: "tomorrow"
    });

    expect(result.snapshot.mission.status).toBe("COLLECTING_QUOTES");
    expect(result.allProviderContactsSettled).toBe(true);
    expect(result.completedEvidencePending).toBe(true);
    expect(result.snapshot.recommendation).toBeUndefined();
  });
});
