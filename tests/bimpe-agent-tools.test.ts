import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemoMissionSnapshot } from "../lib/mission/demo-engine";
import { buildInitialMissionSnapshot } from "../lib/mission/initial-snapshot";
import { buildTemporaryDemoQuotes } from "../lib/demo/temporary-scenario";
import { bimpeToolManifest } from "../lib/integrations/bimpe/tool-manifest";
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

import {
  compareQuotesForAgent,
  recordProviderResponseForAgent,
  recordQuoteForAgent,
  requestHumanApprovalForAgent,
  searchProvidersForAgent
} from "../lib/integrations/bimpe/tools";

const PERFUME_REQUEST =
  "I need 12 bottles of 50ml long-lasting unisex perfume delivered to Yaba tomorrow. My budget is ₦120,000.";

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

  it("exposes the bounded golden-path tool manifest", () => {
    expect(bimpeToolManifest.map((tool) => tool.name)).toEqual([
      "searchProviders",
      "getProvider",
      "callProvider",
      "refreshCommunication",
      "getCommunicationEvidence",
      "recordProviderResponse",
      "recordQuote",
      "compareQuotes",
      "orchestrateMission",
      "requestApproval"
    ]);
  });

  it("returns explicit simulation providers but refuses to fake a live directory", () => {
    const providers = searchProvidersForAgent({
      mode: "SIMULATION",
      category: "Perfume"
    });
    expect(providers.length).toBeGreaterThan(0);

    expect(() => searchProvidersForAgent({ mode: "LIVE" })).toThrow(
      "LIVE_PROVIDER_DIRECTORY_NOT_CONFIGURED"
    );
  });

  it("persists source-referenced Quotes only during a valid collection/comparison stage", async () => {
    const snapshot = buildDemoMissionSnapshot(PERFUME_REQUEST, "mission-tools");
    repositoryMocks.current = {
      ...snapshot,
      mission: { ...snapshot.mission, status: "COLLECTING_QUOTES" },
      quotes: []
    };

    const quote = buildTemporaryDemoQuotes(snapshot.mission)[0];
    const updated = await recordQuoteForAgent({ quote });

    expect(updated.quotes).toHaveLength(1);
    expect(updated.quotes[0].sourceReference).toBe(
      "hackathon-perfume-simulation"
    );
  });

  it("turns structured factual fields into a traceable Quote only after completed communication", async () => {
    const snapshot = buildDemoMissionSnapshot(
      PERFUME_REQUEST,
      "mission-provider-response"
    );
    const provider = snapshot.providers[0];
    const communication = communicationResultSchema.parse({
      id: "communication-provider-response",
      missionId: snapshot.mission.id,
      providerId: provider.id,
      channel: "CALL",
      status: "COMPLETED",
      externalId: "vapi-call-123",
      summary: "Verified communication evidence is available for structured extraction.",
      occurredAt: "2026-10-01T21:00:00.000Z"
    });

    repositoryMocks.current = {
      ...snapshot,
      mission: { ...snapshot.mission, status: "COLLECTING_QUOTES" },
      communications: [communication],
      quotes: []
    };

    const result = await recordProviderResponseForAgent({
      missionId: snapshot.mission.id,
      communicationId: communication.id,
      available: true,
      price: 96000,
      deliveryFee: 5000,
      total: 101000,
      deliveryDate: "tomorrow",
      notes: "Structured facts supplied by the downstream evidence extractor."
    });

    expect(result.quote.providerId).toBe(provider.id);
    expect(result.quote.source).toBe("CALL");
    expect(result.quote.sourceReference).toBe("vapi-call-123");
    expect(result.quote.total).toBe(101000);
    expect(result.snapshot.communications[0].observation?.price).toBe(96000);
    expect(result.snapshot.quotes).toHaveLength(1);
  });

  it("refuses to create a Quote from a no-answer communication", async () => {
    const snapshot = buildDemoMissionSnapshot(PERFUME_REQUEST, "mission-no-answer");
    const provider = snapshot.providers[0];
    const communication = communicationResultSchema.parse({
      id: "communication-no-answer",
      missionId: snapshot.mission.id,
      providerId: provider.id,
      channel: "CALL",
      status: "NO_ANSWER",
      externalId: "vapi-call-no-answer",
      summary: "Provider did not answer.",
      occurredAt: "2026-10-01T21:00:00.000Z"
    });

    repositoryMocks.current = {
      ...snapshot,
      mission: { ...snapshot.mission, status: "COLLECTING_QUOTES" },
      communications: [communication],
      quotes: []
    };

    await expect(
      recordProviderResponseForAgent({
        missionId: snapshot.mission.id,
        communicationId: communication.id,
        available: true,
        total: 101000,
        deliveryDate: "tomorrow"
      })
    ).rejects.toThrow("COMMUNICATION_NOT_COMPLETED");

    expect(repositoryMocks.saveMissionSnapshot).not.toHaveBeenCalled();
  });

  it("refuses to record a Quote before provider contact", async () => {
    const snapshot = buildInitialMissionSnapshot(
      "I need perfume tomorrow.",
      "mission-too-early",
      true
    );
    repositoryMocks.current = {
      ...snapshot,
      providers: buildDemoMissionSnapshot("Find perfume", "source").providers
    };

    const quote = buildTemporaryDemoQuotes({
      ...snapshot.mission,
      id: "mission-too-early"
    })[0];

    await expect(recordQuoteForAgent({ quote })).rejects.toThrow(
      "MISSION_NOT_READY_FOR_QUOTE_RECORDING"
    );
  });

  it("refuses comparison before the Mission reaches COMPARING", async () => {
    const snapshot = buildDemoMissionSnapshot(
      PERFUME_REQUEST,
      "mission-compare-early"
    );
    repositoryMocks.current = {
      ...snapshot,
      mission: { ...snapshot.mission, status: "COLLECTING_QUOTES" }
    };

    await expect(compareQuotesForAgent("mission-compare-early")).rejects.toThrow(
      "MISSION_NOT_READY_FOR_COMPARISON"
    );
  });

  it("requests human approval without approving or transacting", async () => {
    const snapshot = buildDemoMissionSnapshot(
      PERFUME_REQUEST,
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
