import { describe, expect, it } from "vitest";
import {
  InMemoryCommunicationEventDeduplicator,
  processCommunicationEvent
} from "../lib/integrations/communication/event-processor";
import { MockCommunicationAdapter } from "../lib/integrations/communication/mock";

function completedMockEvent(eventId: string) {
  return {
    eventId,
    missionId: "mission-demo",
    providerId: "provider-demo",
    status: "completed",
    observation: {
      available: true,
      price: 62000
    },
    occurredAt: new Date().toISOString()
  };
}

describe("communication event processor", () => {
  it("processes the first event and rejects the duplicate without reprocessing", async () => {
    const adapter = new MockCommunicationAdapter();
    const deduplicator = new InMemoryCommunicationEventDeduplicator();
    const payload = completedMockEvent("event-duplicate");
    const correlation = {
      missionId: "mission-demo",
      providerId: "provider-demo"
    };

    const first = await processCommunicationEvent({
      eventId: "event-duplicate",
      payload,
      adapter,
      correlation,
      deduplicator
    });

    const second = await processCommunicationEvent({
      eventId: "event-duplicate",
      payload,
      adapter,
      correlation,
      deduplicator
    });

    expect(first.kind).toBe("PROCESSED");
    expect(second).toEqual({
      kind: "DUPLICATE",
      eventId: "event-duplicate"
    });
  });

  it("returns unknown correlation without claiming the event", async () => {
    const adapter = new MockCommunicationAdapter();
    const deduplicator = new InMemoryCommunicationEventDeduplicator();
    const payload = completedMockEvent("event-late-correlation");

    const unknown = await processCommunicationEvent({
      eventId: "event-late-correlation",
      payload,
      adapter,
      deduplicator
    });

    const processed = await processCommunicationEvent({
      eventId: "event-late-correlation",
      payload,
      adapter,
      correlation: {
        missionId: "mission-demo",
        providerId: "provider-demo"
      },
      deduplicator
    });

    expect(unknown).toEqual({
      kind: "UNKNOWN_CORRELATION",
      eventId: "event-late-correlation"
    });
    expect(processed.kind).toBe("PROCESSED");
  });

  it("rejects a correlation mismatch and releases the event for retry", async () => {
    const adapter = new MockCommunicationAdapter();
    const deduplicator = new InMemoryCommunicationEventDeduplicator();
    const payload = completedMockEvent("event-correlation-mismatch");

    await expect(
      processCommunicationEvent({
        eventId: "event-correlation-mismatch",
        payload,
        adapter,
        correlation: {
          missionId: "mission-other",
          providerId: "provider-demo"
        },
        deduplicator
      })
    ).rejects.toThrow("Communication correlation mismatch");

    const retry = await processCommunicationEvent({
      eventId: "event-correlation-mismatch",
      payload,
      adapter,
      correlation: {
        missionId: "mission-demo",
        providerId: "provider-demo"
      },
      deduplicator
    });

    expect(retry.kind).toBe("PROCESSED");
  });

  it("releases malformed events so a corrected retry can be processed", async () => {
    const adapter = new MockCommunicationAdapter();
    const deduplicator = new InMemoryCommunicationEventDeduplicator();
    const correlation = {
      missionId: "mission-demo",
      providerId: "provider-demo"
    };

    await expect(
      processCommunicationEvent({
        eventId: "event-malformed",
        payload: { status: "completed" },
        adapter,
        correlation,
        deduplicator
      })
    ).rejects.toThrow();

    const retry = await processCommunicationEvent({
      eventId: "event-malformed",
      payload: completedMockEvent("event-malformed"),
      adapter,
      correlation,
      deduplicator
    });

    expect(retry.kind).toBe("PROCESSED");
  });
});
