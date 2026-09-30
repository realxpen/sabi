import { describe, expect, it } from "vitest";
import { MockCommunicationAdapter } from "../lib/integrations/communication/mock";
import { processCommunicationEvent } from "../lib/integrations/communication/event-processor";
import {
  createNeonCommunicationEventDeduplicatorFromEnvironment,
  NeonCommunicationEventDeduplicator,
  NeonCommunicationEventDeduplicatorConfigurationError,
  NeonCommunicationEventDeduplicatorError,
  type NeonCommunicationEventDedupeSql
} from "../lib/integrations/neon/communication-event-deduplicator";

const environment = {
  DATABASE_URL: "postgresql://test:test@localhost/neondb"
};

function createPersistentSqlMock() {
  const claimed = new Set<string>();
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?");
    calls.push({ text, values });

    if (text.includes("INSERT INTO communication_event_claims")) {
      const eventId = String(values[0]);
      if (claimed.has(eventId)) return [];
      claimed.add(eventId);
      return [{ event_id: eventId }];
    }

    if (text.includes("DELETE FROM communication_event_claims")) {
      claimed.delete(String(values[0]));
      return [];
    }

    throw new Error("Unexpected SQL in test");
  }) as unknown as NeonCommunicationEventDedupeSql;

  return { sql, calls };
}

function completedMockEvent(eventId: string) {
  return {
    eventId,
    missionId: "mission-demo",
    providerId: "provider-demo",
    status: "completed",
    observation: { available: true, price: 62000 },
    occurredAt: "2026-09-30T20:00:00.000Z"
  };
}

describe("Neon communication event deduplicator", () => {
  it("fails closed when DATABASE_URL is not PostgreSQL", () => {
    expect(
      () => new NeonCommunicationEventDeduplicator({ DATABASE_URL: "invalid" })
    ).toThrow(NeonCommunicationEventDeduplicatorConfigurationError);
  });

  it("returns undefined when durable Neon configuration is absent", () => {
    expect(createNeonCommunicationEventDeduplicatorFromEnvironment({})).toBeUndefined();
  });

  it("claims an event atomically with parameterized SQL", async () => {
    const { sql, calls } = createPersistentSqlMock();
    const deduplicator = new NeonCommunicationEventDeduplicator(environment, sql);

    await expect(deduplicator.claim("event-123")).resolves.toBe(true);
    expect(calls[0]?.text).toContain("INSERT INTO communication_event_claims");
    expect(calls[0]?.text).toContain("ON CONFLICT (event_id) DO NOTHING");
    expect(calls[0]?.text).toContain("RETURNING event_id");
    expect(calls[0]?.values).toEqual(["event-123"]);
  });

  it("treats a claim from another process instance as a duplicate", async () => {
    const { sql } = createPersistentSqlMock();
    const firstInstance = new NeonCommunicationEventDeduplicator(environment, sql);
    const secondInstance = new NeonCommunicationEventDeduplicator(environment, sql);

    await expect(firstInstance.claim("event-shared")).resolves.toBe(true);
    await expect(secondInstance.claim("event-shared")).resolves.toBe(false);
  });

  it("releases a failed claim so a corrected retry can be processed", async () => {
    const { sql } = createPersistentSqlMock();
    const deduplicator = new NeonCommunicationEventDeduplicator(environment, sql);
    const adapter = new MockCommunicationAdapter();

    await expect(
      processCommunicationEvent({
        eventId: "event-retry",
        payload: { status: "completed" },
        adapter,
        correlation: { missionId: "mission-demo", providerId: "provider-demo" },
        deduplicator
      })
    ).rejects.toThrow();

    const retry = await processCommunicationEvent({
      eventId: "event-retry",
      payload: completedMockEvent("event-retry"),
      adapter,
      correlation: { missionId: "mission-demo", providerId: "provider-demo" },
      deduplicator
    });

    expect(retry.kind).toBe("PROCESSED");
  });

  it("prevents the same processed event from being normalized twice across instances", async () => {
    const { sql } = createPersistentSqlMock();
    const firstInstance = new NeonCommunicationEventDeduplicator(environment, sql);
    const secondInstance = new NeonCommunicationEventDeduplicator(environment, sql);
    const adapter = new MockCommunicationAdapter();
    const payload = completedMockEvent("event-once");
    const correlation = { missionId: "mission-demo", providerId: "provider-demo" };

    const first = await processCommunicationEvent({
      eventId: "event-once",
      payload,
      adapter,
      correlation,
      deduplicator: firstInstance
    });
    const duplicate = await processCommunicationEvent({
      eventId: "event-once",
      payload,
      adapter,
      correlation,
      deduplicator: secondInstance
    });

    expect(first.kind).toBe("PROCESSED");
    expect(duplicate).toEqual({ kind: "DUPLICATE", eventId: "event-once" });
  });

  it("sanitizes database query failures", async () => {
    const sql = (async () => {
      throw new Error("sensitive database details");
    }) as unknown as NeonCommunicationEventDedupeSql;
    const deduplicator = new NeonCommunicationEventDeduplicator(environment, sql);

    await expect(deduplicator.claim("event-error")).rejects.toEqual(
      new NeonCommunicationEventDeduplicatorError(
        "Neon communication event claim query failed."
      )
    );
  });
});
