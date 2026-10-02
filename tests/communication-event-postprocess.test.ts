import { describe, expect, it } from "vitest";
import {
  InMemoryCommunicationEventDeduplicator,
  processCommunicationEvent
} from "../lib/integrations/communication/event-processor";
import { MockCommunicationAdapter } from "../lib/integrations/communication/mock";

function completedMockEvent() {
  return {
    eventId: "event-postprocess",
    missionId: "mission-demo",
    providerId: "provider-demo",
    status: "completed",
    observation: {
      available: true,
      price: 62000
    },
    occurredAt: "2026-10-02T08:00:00.000Z"
  };
}

describe("communication event durable postprocessing", () => {
  it("releases the dedupe claim when postprocessing fails so the provider retry can succeed", async () => {
    const adapter = new MockCommunicationAdapter();
    const deduplicator = new InMemoryCommunicationEventDeduplicator();
    const payload = completedMockEvent();
    const correlation = {
      missionId: "mission-demo",
      providerId: "provider-demo"
    };

    await expect(
      processCommunicationEvent({
        eventId: "event-postprocess",
        payload,
        adapter,
        correlation,
        deduplicator,
        afterNormalize: async () => {
          throw new Error("MISSION_PERSISTENCE_FAILED");
        }
      })
    ).rejects.toThrow("MISSION_PERSISTENCE_FAILED");

    let persisted = false;
    const retry = await processCommunicationEvent({
      eventId: "event-postprocess",
      payload,
      adapter,
      correlation,
      deduplicator,
      afterNormalize: async () => {
        persisted = true;
      }
    });

    expect(retry.kind).toBe("PROCESSED");
    expect(persisted).toBe(true);
  });
});
