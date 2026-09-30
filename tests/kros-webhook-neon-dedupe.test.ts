import { describe, expect, it } from "vitest";
import {
  createKrosWebhookPostHandlerWithNeonDedupe,
  type KrosWebhookRuntimeDependencies
} from "../lib/integrations/communication/kros-webhook-handler";
import { MockCommunicationAdapter } from "../lib/integrations/communication/mock";
import type { NeonCommunicationEventDedupeSql } from "../lib/integrations/neon/communication-event-deduplicator";

const decoder = new TextDecoder();
const environment = {
  DATABASE_URL: "postgresql://test:test@localhost/neondb"
};

function createPersistentSqlMock() {
  const claimed = new Set<string>();
  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?");

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

  return sql;
}

function runtimeDependencies(): KrosWebhookRuntimeDependencies {
  return {
    verifier: {
      async verify({ signature }) {
        return signature === "test-signature";
      }
    },
    parser: {
      async parse(rawBody) {
        return JSON.parse(decoder.decode(rawBody));
      }
    },
    correlationResolver: {
      async resolve() {
        return {
          missionId: "mission-demo",
          providerId: "provider-demo"
        };
      }
    },
    adapter: new MockCommunicationAdapter()
  };
}

function requestFor(eventId: string) {
  return new Request("http://localhost/api/webhooks/krosai", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-webhook-signature": "test-signature"
    },
    body: JSON.stringify({
      eventId,
      correlationKey: "known-correlation",
      payload: {
        eventId,
        missionId: "mission-demo",
        providerId: "provider-demo",
        status: "completed",
        observation: {
          available: true,
          price: 12000
        },
        occurredAt: "2026-09-30T12:00:00.000Z"
      }
    })
  });
}

describe("Kros webhook Neon dedupe wiring", () => {
  it("deduplicates across separate handler instances sharing durable state", async () => {
    const sql = createPersistentSqlMock();
    const firstHandler = createKrosWebhookPostHandlerWithNeonDedupe(
      runtimeDependencies(),
      environment,
      sql
    );
    const secondHandler = createKrosWebhookPostHandlerWithNeonDedupe(
      runtimeDependencies(),
      environment,
      sql
    );

    const first = await firstHandler(requestFor("event-cross-instance"));
    const second = await secondHandler(requestFor("event-cross-instance"));

    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      ok: true,
      kind: "PROCESSED",
      eventId: "event-cross-instance"
    });
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({
      ok: true,
      kind: "DUPLICATE",
      eventId: "event-cross-instance"
    });
  });

  it("fails closed instead of falling back to memory when DATABASE_URL is absent", async () => {
    const handler = createKrosWebhookPostHandlerWithNeonDedupe(
      runtimeDependencies(),
      {}
    );

    const response = await handler(requestFor("event-no-db"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      ok: false,
      error: "KROSAI_WEBHOOK_NOT_CONFIGURED"
    });
  });
});
