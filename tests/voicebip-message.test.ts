import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import type {
  CommunicationCorrelation,
  CommunicationCorrelationRepository
} from "../lib/repositories/communication-correlation-repository";
import {
  createVoicebipMessageTransport
} from "../lib/integrations/communication/voicebip-message";
import {
  createConfiguredMessageTransport
} from "../lib/integrations/communication/message-runtime";
import {
  createVoicebipWebhookPostHandler
} from "../lib/integrations/communication/voicebip-webhook-handler";
import type { NeonCommunicationEventDedupeSql } from "../lib/integrations/neon/communication-event-deduplicator";
import { sendMessage } from "../lib/tools/provider-tools";
import { handleBimpeToolRequest } from "../lib/integrations/bimpe/tool-bridge";

class MemoryCorrelationRepository
  implements CommunicationCorrelationRepository
{
  private readonly rows = new Map<string, CommunicationCorrelation>();

  async savePending(
    correlation: Omit<CommunicationCorrelation, "externalId">
  ): Promise<CommunicationCorrelation> {
    const existing = this.rows.get(correlation.communicationId);
    if (existing) return existing;
    const stored: CommunicationCorrelation = { ...correlation };
    this.rows.set(stored.communicationId, stored);
    return stored;
  }

  async attachExternalId(
    communicationId: string,
    externalId: string
  ): Promise<CommunicationCorrelation> {
    const row = this.rows.get(communicationId);
    if (!row) throw new Error("missing pending row");
    const updated = { ...row, externalId };
    this.rows.set(communicationId, updated);
    return updated;
  }

  async getByCommunicationId(
    communicationId: string
  ): Promise<CommunicationCorrelation | undefined> {
    return this.rows.get(communicationId);
  }

  async getByExternalId(
    externalId: string
  ): Promise<CommunicationCorrelation | undefined> {
    return [...this.rows.values()].find(
      (row) => row.externalId === externalId
    );
  }
}

function dedupeSqlMock() {
  const claimed = new Set<string>();
  return (async (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => {
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

    throw new Error("unexpected SQL");
  }) as unknown as NeonCommunicationEventDedupeSql;
}

const environment = {
  SABI_MESSAGE_MODE: "voicebip-temlio",
  SABI_CONSENTED_PROVIDER_MESSAGE_PHONES_JSON: JSON.stringify({
    "provider-tola-fabrics": "+2348000002000"
  }),
  VOICEBIP_API_BASE_URL: "https://api.voicebip.com/v1",
  VOICEBIP_API_KEY: "pk_test_private",
  VOICEBIP_AGENT_ID: "agt_test",
  VOICEBIP_SMS_FROM_NUMBER: "+2348000001000",
  VOICEBIP_WEBHOOK_SIGNING_SECRET: "webhook-secret",
  DATABASE_URL: "postgresql://test:test@localhost/neondb"
};

const input = {
  missionId: "mission-sms-1",
  providerId: "provider-tola-fabrics",
  communicationId: "communication-sms-1",
  message: "Can you confirm availability and price?"
};

function signedRequest(
  payload: unknown,
  timestampSeconds: number,
  secret = "webhook-secret"
) {
  const body = JSON.stringify(payload);
  const signature = `sha256=${createHmac("sha256", secret)
    .update(String(timestampSeconds))
    .update(".")
    .update(body)
    .digest("hex")}`;

  return new Request("https://sabi.example/api/webhooks/voicebip", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Voicebip-Signature": signature,
      "X-Voicebip-Timestamp": String(timestampSeconds),
      "X-Voicebip-Event-ID": String(
        (payload as { event_id?: string }).event_id ?? ""
      )
    },
    body
  });
}

function deliveredEvent(eventId = "evt-delivered") {
  return {
    event_id: eventId,
    event_type: "message.dlr",
    channel: "sms",
    agent_id: "agt_test",
    number: "+2348000001000",
    from: "+2348000002000",
    timestamp: "2026-10-01T10:00:00.000Z",
    payload: {
      message_id: "msg-test-1",
      status: "DELIVRD",
      error_code: "000",
      submitted: 1,
      delivered: 1
    }
  };
}

describe("Voicebip / Temlio SMS transport", () => {
  it("is disabled by default", async () => {
    expect(createConfiguredMessageTransport({})).toBeUndefined();

    const result = await sendMessage(input);
    expect(result.status).toBe("UNAVAILABLE");
    expect(result.channel).toBe("SMS");
  });

  it("fails closed without explicit message consent and makes no request", async () => {
    let requests = 0;
    const fetchStub = (async () => {
      requests += 1;
      return new Response();
    }) as typeof fetch;
    const transport = createVoicebipMessageTransport(
      {
        ...environment,
        SABI_CONSENTED_PROVIDER_MESSAGE_PHONES_JSON: "{}"
      },
      fetchStub,
      new MemoryCorrelationRepository()
    );

    const result = await sendMessage(input, transport);

    expect(requests).toBe(0);
    expect(result.status).toBe("FAILED");
    expect(result.errorCode).toBe("MESSAGE_DESTINATION_NOT_CONSENTED");
    expect(result.observation).toBeUndefined();
  });

  it("persists pre-send correlation and sends the documented SMS request", async () => {
    const repository = new MemoryCorrelationRepository();
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchStub = (async (
      request: RequestInfo | URL,
      init?: RequestInit
    ) => {
      calls.push({ url: String(request), init });
      return new Response(
        JSON.stringify({
          message_id: "msg-test-1",
          channel: "sms",
          status: "queued",
          from_number: "+2348000001000",
          to_number: "+2348000002000",
          segments: 1,
          created_at: "2026-10-01T09:59:55.000Z"
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }) as typeof fetch;

    const transport = createVoicebipMessageTransport(
      environment,
      fetchStub,
      repository
    );
    const result = await sendMessage(input, transport);

    expect(result).toMatchObject({
      id: "communication-sms-1",
      missionId: "mission-sms-1",
      providerId: "provider-tola-fabrics",
      channel: "SMS",
      status: "INITIATED",
      externalId: "msg-test-1"
    });
    expect(result.observation).toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.voicebip.com/v1/messages");
    expect(calls[0]?.init?.headers).toMatchObject({
      Authorization: "Bearer pk_test_private",
      "Content-Type": "application/json"
    });
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      agent_id: "agt_test",
      channel: "sms",
      from_number: "+2348000001000",
      to_number: "+2348000002000",
      body: input.message
    });

    expect(
      await repository.getByCommunicationId("communication-sms-1")
    ).toMatchObject({
      externalId: "msg-test-1",
      missionId: "mission-sms-1",
      providerId: "provider-tola-fabrics"
    });
  });

  it("does not resend an already correlated communication", async () => {
    const repository = new MemoryCorrelationRepository();
    await repository.savePending({
      communicationId: input.communicationId,
      missionId: input.missionId,
      providerId: input.providerId,
      channel: "SMS",
      createdAt: "2026-10-01T09:00:00.000Z"
    });
    await repository.attachExternalId(input.communicationId, "msg-existing");

    let requests = 0;
    const transport = createVoicebipMessageTransport(
      environment,
      (async () => {
        requests += 1;
        return new Response();
      }) as typeof fetch,
      repository
    );

    const result = await transport(input);

    expect(requests).toBe(0);
    expect(result.status).toBe("INITIATED");
    expect(result.externalId).toBe("msg-existing");
    expect(result.summary).toContain("No duplicate SMS was sent");
  });

  it("supports the bounded SABI sendMessage route contract without adding a Quote", async () => {
    const response = await handleBimpeToolRequest(
      new Request("https://sabi.example/api/agent-tools/send-message", {
        method: "POST",
        headers: {
          Authorization: "Bearer bridge-secret",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(input)
      }),
      "sendMessage",
      {
        environment: { SABI_AGENT_TOOL_TOKEN: "bridge-secret" },
        messageTransport: async (candidate) => ({
          id: candidate.communicationId,
          missionId: candidate.missionId,
          providerId: candidate.providerId,
          channel: "SMS",
          status: "INITIATED",
          externalId: "msg-bridge",
          summary: "Fixture send accepted.",
          occurredAt: "2026-10-01T10:00:00.000Z"
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.externalId).toBe("msg-bridge");
    expect(payload.meta.quoteCreated).toBe(false);
  });
});

describe("Voicebip webhook normalization", () => {
  it("verifies HMAC, correlates, deduplicates and normalizes delivery", async () => {
    const repository = new MemoryCorrelationRepository();
    await repository.savePending({
      communicationId: input.communicationId,
      missionId: input.missionId,
      providerId: input.providerId,
      channel: "SMS",
      createdAt: "2026-10-01T09:00:00.000Z"
    });
    await repository.attachExternalId(input.communicationId, "msg-test-1");

    const nowSeconds = Math.floor(
      new Date("2026-10-01T10:00:30.000Z").getTime() / 1000
    );
    const handler = createVoicebipWebhookPostHandler(
      environment,
      undefined,
      dedupeSqlMock(),
      repository,
      () => nowSeconds * 1000
    );

    const first = await handler(
      signedRequest(deliveredEvent(), nowSeconds)
    );
    const firstPayload = await first.json();
    const duplicate = await handler(
      signedRequest(deliveredEvent(), nowSeconds)
    );
    const duplicatePayload = await duplicate.json();

    expect(first.status).toBe(200);
    expect(firstPayload).toMatchObject({
      ok: true,
      kind: "PROCESSED",
      quoteCreated: false,
      communication: {
        id: "communication-sms-1",
        status: "COMPLETED",
        channel: "SMS",
        externalId: "msg-test-1"
      }
    });
    expect(firstPayload.communication.observation).toBeUndefined();
    expect(duplicate.status).toBe(200);
    expect(duplicatePayload.kind).toBe("DUPLICATE");
  });

  it("rejects invalid or stale signatures", async () => {
    const repository = new MemoryCorrelationRepository();
    const nowSeconds = 1_800_000_000;
    const handler = createVoicebipWebhookPostHandler(
      environment,
      undefined,
      dedupeSqlMock(),
      repository,
      () => nowSeconds * 1000
    );

    const bad = await handler(
      signedRequest(deliveredEvent("evt-bad"), nowSeconds, "wrong-secret")
    );
    expect(bad.status).toBe(401);

    const stale = await handler(
      signedRequest(deliveredEvent("evt-stale"), nowSeconds - 301)
    );
    expect(stale.status).toBe(401);
  });

  it("returns UNKNOWN_CORRELATION for an authenticated unknown message ID", async () => {
    const nowSeconds = 1_800_000_000;
    const handler = createVoicebipWebhookPostHandler(
      environment,
      undefined,
      dedupeSqlMock(),
      new MemoryCorrelationRepository(),
      () => nowSeconds * 1000
    );

    const response = await handler(
      signedRequest(deliveredEvent("evt-unknown"), nowSeconds)
    );
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.kind).toBe("UNKNOWN_CORRELATION");
    expect(payload.externalId).toBe("msg-test-1");
  });

  it("normalizes provider failure without creating Quote evidence", async () => {
    const repository = new MemoryCorrelationRepository();
    await repository.savePending({
      communicationId: input.communicationId,
      missionId: input.missionId,
      providerId: input.providerId,
      channel: "SMS",
      createdAt: "2026-10-01T09:00:00.000Z"
    });
    await repository.attachExternalId(input.communicationId, "msg-test-1");

    const nowSeconds = 1_800_000_000;
    const handler = createVoicebipWebhookPostHandler(
      environment,
      undefined,
      dedupeSqlMock(),
      repository,
      () => nowSeconds * 1000
    );
    const event = {
      ...deliveredEvent("evt-failed"),
      event_type: "message.failed",
      payload: {
        message_id: "msg-test-1",
        error_code: "OPT_OUT_ENFORCED"
      }
    };

    const response = await handler(signedRequest(event, nowSeconds));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.communication.status).toBe("FAILED");
    expect(payload.communication.observation).toBeUndefined();
    expect(payload.quoteCreated).toBe(false);
  });
});
