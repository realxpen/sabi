// Integration gate: Lara communication evidence + Femi deterministic intelligence.
import { describe, expect, it } from "vitest";
import {
  InMemoryCommunicationEventDeduplicator,
  processCommunicationEvent
} from "../lib/integrations/communication/event-processor";
import type { CommunicationAdapter } from "../lib/integrations/communication/types";
import {
  communicationResultSchema,
  missionSchema,
  providerSchema,
  quoteSchema
} from "../lib/schemas";
import { recommend } from "../lib/intelligence";

const communication = communicationResultSchema.parse({
  id: "communication-live-1",
  missionId: "mission-1",
  providerId: "provider-a",
  channel: "CALL",
  status: "NO_ANSWER",
  externalId: "call-1",
  summary: "Provider did not answer. No Quote evidence was produced.",
  occurredAt: "2026-10-01T18:00:00.000Z"
});

const adapter: CommunicationAdapter = {
  name: "test",
  async initiateContact() {
    return communication;
  },
  async normalizeEvent() {
    return communication;
  }
};

describe("integrated communication persistence seam", () => {
  it("persists normalized evidence before retaining the event claim", async () => {
    const deduplicator = new InMemoryCommunicationEventDeduplicator();
    const persisted: string[] = [];

    const result = await processCommunicationEvent({
      eventId: "event-1",
      payload: {},
      adapter,
      correlation: { missionId: "mission-1", providerId: "provider-a" },
      deduplicator,
      onProcessed: async (value) => {
        persisted.push(value.id);
      }
    });

    expect(result.kind).toBe("PROCESSED");
    expect(persisted).toEqual(["communication-live-1"]);

    const duplicate = await processCommunicationEvent({
      eventId: "event-1",
      payload: {},
      adapter,
      correlation: { missionId: "mission-1", providerId: "provider-a" },
      deduplicator,
      onProcessed: async () => {
        throw new Error("must not run for duplicate");
      }
    });

    expect(duplicate.kind).toBe("DUPLICATE");
  });

  it("releases the event claim when Mission persistence fails", async () => {
    const deduplicator = new InMemoryCommunicationEventDeduplicator();

    await expect(
      processCommunicationEvent({
        eventId: "event-retry",
        payload: {},
        adapter,
        correlation: { missionId: "mission-1", providerId: "provider-a" },
        deduplicator,
        onProcessed: async () => {
          throw new Error("temporary mission persistence failure");
        }
      })
    ).rejects.toThrow("temporary mission persistence failure");

    const retry = await processCommunicationEvent({
      eventId: "event-retry",
      payload: {},
      adapter,
      correlation: { missionId: "mission-1", providerId: "provider-a" },
      deduplicator,
      onProcessed: async () => undefined
    });

    expect(retry.kind).toBe("PROCESSED");
  });
});

describe("integrated Femi intelligence", () => {
  it("rejects hard-constraint failures before deterministic ranking", () => {
    const mission = missionSchema.parse({
      id: "mission-1",
      type: "PROCUREMENT",
      status: "COMPARING",
      rawRequest: "I need black Ankara tomorrow under ₦70,000",
      item: "Black Ankara fabric",
      budget: 70000,
      deadline: "tomorrow",
      approvalRequired: true,
      createdAt: "2026-10-01T18:00:00.000Z"
    });

    const providers = [
      providerSchema.parse({
        id: "provider-a",
        name: "Provider A",
        category: "Fabric",
        location: "Yaba",
        languages: ["English"],
        verified: true,
        reliabilityScore: 0.94,
        active: true
      }),
      providerSchema.parse({
        id: "provider-b",
        name: "Provider B",
        category: "Fabric",
        location: "Yaba",
        languages: ["English"],
        verified: true,
        active: true
      }),
      providerSchema.parse({
        id: "provider-c",
        name: "Provider C",
        category: "Fabric",
        location: "Yaba",
        languages: ["English"],
        verified: true,
        active: true
      })
    ];

    const quotes = [
      quoteSchema.parse({
        id: "quote-a",
        missionId: "mission-1",
        providerId: "provider-a",
        available: true,
        total: 63000,
        deliveryDate: "tomorrow",
        source: "CALL",
        sourceReference: "call-a",
        createdAt: "2026-10-01T18:05:00.000Z"
      }),
      quoteSchema.parse({
        id: "quote-b",
        missionId: "mission-1",
        providerId: "provider-b",
        available: true,
        total: 55000,
        deliveryDate: "in 3 days",
        source: "CALL",
        sourceReference: "call-b",
        createdAt: "2026-10-01T18:06:00.000Z"
      }),
      quoteSchema.parse({
        id: "quote-c",
        missionId: "mission-1",
        providerId: "provider-c",
        available: true,
        total: 74000,
        deliveryDate: "tomorrow",
        source: "CALL",
        sourceReference: "call-c",
        createdAt: "2026-10-01T18:07:00.000Z"
      })
    ];

    const result = recommend(mission, providers, quotes);

    expect(result.selected?.provider.id).toBe("provider-a");
    expect(result.exclusions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ providerId: "provider-b" }),
        expect.objectContaining({ providerId: "provider-c" })
      ])
    );
    expect(result.approvalRequired).toBe(true);
  });
});
