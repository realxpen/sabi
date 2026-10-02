import { describe, expect, it } from "vitest";
import type { CommunicationResult } from "../lib/schemas";
import {
  persistCommunicationIntelligence,
  type MissionSnapshotStore
} from "../lib/mission/communication-intelligence-persistence";
import type { MissionSnapshot } from "../lib/mission/snapshot";
import { extractVerifiedVapiTranscript } from "../lib/integrations/communication/vapi-intelligence-persistence";

const occurredAt = "2026-10-02T08:00:00.000Z";

function snapshot(quantity?: number): MissionSnapshot {
  return {
    mission: {
      id: "mission-ankara",
      type: "PROCUREMENT",
      status: "COLLECTING_QUOTES",
      rawRequest: quantity
        ? `I need ${quantity} yards of black Ankara delivered to Yaba tomorrow under ₦70,000.`
        : "I need black Ankara delivered to Yaba tomorrow under ₦70,000.",
      item: "black Ankara",
      quantity,
      unit: quantity ? "yards" : undefined,
      budget: 70000,
      location: "Yaba",
      deadline: "tomorrow",
      approvalRequired: true,
      createdAt: occurredAt
    },
    steps: [],
    providers: [
      {
        id: "provider-ade",
        name: "Ade Textiles",
        category: "Fabric",
        location: "Surulere",
        languages: ["English"],
        verified: true,
        rating: 4.8,
        reliabilityScore: 0.94,
        active: true
      }
    ],
    communications: [],
    quotes: [],
    demoMode: false
  };
}

class MemoryStore implements MissionSnapshotStore {
  saves = 0;

  constructor(public value: MissionSnapshot) {}

  async get(missionId: string): Promise<MissionSnapshot | null> {
    return this.value.mission.id === missionId ? this.value : null;
  }

  async save(next: MissionSnapshot): Promise<MissionSnapshot> {
    this.saves += 1;
    this.value = next;
    return next;
  }
}

function completedCommunication(): CommunicationResult {
  return {
    id: "communication-ade",
    missionId: "mission-ankara",
    providerId: "provider-ade",
    channel: "CALL",
    status: "COMPLETED",
    externalId: "vapi-call-ade",
    summary: "Verified Vapi call event includes transcript evidence.",
    occurredAt
  };
}

function transcript(withQuantity: boolean): string {
  return [
    withQuantity
      ? "Assistant: Do you have 20 yards of black Ankara available?"
      : "Assistant: Do you have black Ankara available?",
    withQuantity ? "User: Yes, we have 20 yards available." : "User: Yes, it is available.",
    "Assistant: How much does the Ankara cost?",
    "User: ₦60,000.",
    "Assistant: Can you deliver to Yaba tomorrow?",
    "User: Yes.",
    "Assistant: How much is delivery?",
    "User: ₦3,000."
  ].join("\n");
}

describe("communication intelligence persistence", () => {
  it("persists normalized communication, Quote and READY recommendation atomically", async () => {
    const store = new MemoryStore(snapshot());

    const result = await persistCommunicationIntelligence({
      communication: completedCommunication(),
      transcript: transcript(false),
      store
    });

    expect(store.saves).toBe(1);
    expect(result.normalizedCommunication.observation).toEqual({
      available: true,
      price: 60000,
      deliveryFee: 3000,
      deliveryDate: "tomorrow"
    });
    expect(result.extraction.quote?.total).toBe(63000);
    expect(result.recommendation.decisionStatus).toBe("READY");
    expect(result.snapshot.quotes).toHaveLength(1);
    expect(result.snapshot.recommendation).toEqual({
      providerId: "provider-ade",
      quoteId: "quote-communication-ade",
      reasons: expect.any(Array)
    });
  });

  it("persists truthful Quote evidence but no selected recommendation when quantity remains unrepresented", async () => {
    const store = new MemoryStore(snapshot(20));

    const result = await persistCommunicationIntelligence({
      communication: completedCommunication(),
      transcript: transcript(true),
      store
    });

    expect(store.saves).toBe(1);
    expect(result.extraction.quote?.total).toBe(63000);
    expect(
      result.normalization?.normalization.unrepresentedQuantityEvidence?.quantity
    ).toBe(20);
    expect(result.recommendation.decisionStatus).toBe("BLOCKED_UNKNOWN");
    expect(result.recommendation.requiredFacts.join(" ")).toContain(
      "cannot be independently verified"
    );
    expect(result.snapshot.recommendation).toBeUndefined();
  });

  it("persists no-answer lifecycle evidence without fabricating a Quote", async () => {
    const store = new MemoryStore(snapshot());
    const communication: CommunicationResult = {
      ...completedCommunication(),
      status: "NO_ANSWER",
      summary: "Provider did not answer.",
      errorCode: "customer-did-not-answer"
    };

    const result = await persistCommunicationIntelligence({
      communication,
      store
    });

    expect(store.saves).toBe(1);
    expect(result.extraction.status).toBe("NOT_QUOTABLE");
    expect(result.extraction.quote).toBeUndefined();
    expect(result.snapshot.quotes).toHaveLength(0);
    expect(result.snapshot.communications[0].status).toBe("NO_ANSWER");
    expect(result.snapshot.recommendation).toBeUndefined();
  });

  it("extracts transcript from either verified Vapi transcript location", () => {
    expect(
      extractVerifiedVapiTranscript({
        message: { artifact: { transcript: "Assistant: Hi\nUser: Hello" } }
      })
    ).toContain("User: Hello");

    expect(
      extractVerifiedVapiTranscript({
        message: { transcript: "Assistant: Hi\nUser: Hello again" }
      })
    ).toContain("User: Hello again");
  });
});
