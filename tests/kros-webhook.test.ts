import { describe, expect, it } from "vitest";
import { POST as productionPost } from "../app/api/webhooks/krosai/route";
import { InMemoryCommunicationEventDeduplicator } from "../lib/integrations/communication/event-processor";
import {
  createKrosWebhookPostHandler,
  type KrosWebhookDependencies
} from "../lib/integrations/communication/kros-webhook-handler";
import { MockCommunicationAdapter } from "../lib/integrations/communication/mock";

const decoder = new TextDecoder();

function createTestDependencies(
  onVerify?: (rawBody: Uint8Array, signature: string | null) => void
): KrosWebhookDependencies {
  return {
    verifier: {
      async verify({ rawBody, signature }) {
        onVerify?.(rawBody, signature);
        return signature === "test-signature";
      }
    },
    parser: {
      async parse(rawBody) {
        return JSON.parse(decoder.decode(rawBody));
      }
    },
    correlationResolver: {
      async resolve(correlationKey) {
        if (correlationKey !== "known-correlation") {
          return undefined;
        }

        return {
          missionId: "mission-demo",
          providerId: "provider-demo"
        };
      }
    },
    adapter: new MockCommunicationAdapter(),
    deduplicator: new InMemoryCommunicationEventDeduplicator()
  };
}

function createEnvelope(eventId: string, correlationKey = "known-correlation") {
  return {
    eventId,
    correlationKey,
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
  };
}

function createRequest(body: string, signature = "test-signature") {
  return new Request("http://localhost/api/webhooks/krosai", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-webhook-signature": signature
    },
    body
  });
}

describe("Kros webhook route seam", () => {
  it("preserves raw bytes for verification before parsing and processes a valid event", async () => {
    const body = JSON.stringify(createEnvelope("event-1"));
    let verifiedBody = "";
    let verifiedSignature: string | null = null;
    const post = createKrosWebhookPostHandler(
      createTestDependencies((rawBody, signature) => {
        verifiedBody = decoder.decode(rawBody);
        verifiedSignature = signature;
      })
    );

    const response = await post(createRequest(body));
    const json = await response.json();

    expect(verifiedBody).toBe(body);
    expect(verifiedSignature).toBe("test-signature");
    expect(response.status).toBe(200);
    expect(json).toEqual({
      ok: true,
      kind: "PROCESSED",
      eventId: "event-1"
    });
  });

  it("rejects malformed payloads after signature verification", async () => {
    const post = createKrosWebhookPostHandler(createTestDependencies());
    const response = await post(createRequest("{not-json"));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("MALFORMED_WEBHOOK_PAYLOAD");
  });

  it("returns a successful duplicate acknowledgement without processing twice", async () => {
    const post = createKrosWebhookPostHandler(createTestDependencies());
    const body = JSON.stringify(createEnvelope("event-duplicate"));

    const first = await post(createRequest(body));
    const second = await post(createRequest(body));
    const json = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(json).toEqual({
      ok: true,
      kind: "DUPLICATE",
      eventId: "event-duplicate"
    });
  });

  it("acknowledges an event whose correlation is not known without applying it", async () => {
    const post = createKrosWebhookPostHandler(createTestDependencies());
    const body = JSON.stringify(
      createEnvelope("event-unknown", "unknown-correlation")
    );

    const response = await post(createRequest(body));
    const json = await response.json();

    expect(response.status).toBe(202);
    expect(json).toEqual({
      ok: true,
      kind: "UNKNOWN_CORRELATION",
      eventId: "event-unknown"
    });
  });

  it("rejects an invalid signature before parsing the provider envelope", async () => {
    let parserCalled = false;
    const dependencies = createTestDependencies();
    dependencies.parser = {
      async parse() {
        parserCalled = true;
        return {};
      }
    };
    const post = createKrosWebhookPostHandler(dependencies);

    const response = await post(
      createRequest(JSON.stringify(createEnvelope("event-bad-signature")), "bad")
    );

    expect(response.status).toBe(401);
    expect(parserCalled).toBe(false);
  });

  it("keeps the deployed route fail-closed until the live Kros contract is configured", async () => {
    const response = await productionPost(
      createRequest(JSON.stringify(createEnvelope("event-live")))
    );
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json.error).toBe("KROSAI_WEBHOOK_NOT_CONFIGURED");
  });
});
