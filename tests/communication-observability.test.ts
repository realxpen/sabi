import { describe, expect, it } from "vitest";
import {
  InMemoryCommunicationEventDeduplicator,
  processCommunicationEvent
} from "../lib/integrations/communication/event-processor";
import { MockCommunicationAdapter } from "../lib/integrations/communication/mock";
import {
  InMemoryCommunicationAuditSink,
  buildCommunicationResultAuditRecord,
  buildQuoteLinkAuditRecord
} from "../lib/integrations/communication/observability";
import { communicationResultSchema, quoteSchema } from "../lib/schemas";

const occurredAt = "2026-09-30T18:00:00.000Z";

function completedCommunication() {
  return communicationResultSchema.parse({
    id: "comm-123",
    missionId: "mission-demo",
    providerId: "provider-demo",
    channel: "CALL",
    status: "COMPLETED",
    externalId: "external-call-123",
    summary: "provider said secret transcript words",
    observation: {
      available: true,
      price: 62000,
      notes: "sensitive provider transcript content"
    },
    occurredAt
  });
}

describe("communication observability", () => {
  it("emits metadata-only communication records without transcript-like content", () => {
    const record = buildCommunicationResultAuditRecord(
      completedCommunication(),
      "partner-event-123"
    );
    const serialized = JSON.stringify(record);

    expect(record).toMatchObject({
      kind: "COMMUNICATION_RESULT",
      missionId: "mission-demo",
      providerId: "provider-demo",
      communicationId: "comm-123",
      partnerEventId: "partner-event-123",
      partnerExternalId: "external-call-123",
      status: "COMPLETED",
      sourceChannel: "CALL",
      resultSourceReference: "external-call-123"
    });
    expect(serialized).not.toContain("secret transcript words");
    expect(serialized).not.toContain("sensitive provider transcript content");
    expect(serialized).not.toContain("62000");
  });

  it("records a normalized failure category without logging error detail payloads", () => {
    const failed = communicationResultSchema.parse({
      id: "comm-failed",
      missionId: "mission-demo",
      providerId: "provider-demo",
      channel: "CALL",
      status: "FAILED",
      errorCode: "PROVIDER_NETWORK_FAILURE",
      summary: "Bearer very-secret-key",
      occurredAt
    });

    const record = buildCommunicationResultAuditRecord(failed);

    expect(record).toMatchObject({
      kind: "COMMUNICATION_RESULT",
      communicationId: "comm-failed",
      status: "FAILED",
      failureCategory: "PROVIDER_NETWORK_FAILURE"
    });
    expect(JSON.stringify(record)).not.toContain("very-secret-key");
  });

  it("links a Quote to its CommunicationResult source reference", () => {
    const communication = completedCommunication();
    const quote = quoteSchema.parse({
      id: "quote-123",
      missionId: "mission-demo",
      providerId: "provider-demo",
      available: true,
      price: 62000,
      source: "CALL",
      sourceReference: "external-call-123",
      createdAt: "2026-09-30T18:01:00.000Z"
    });

    expect(buildQuoteLinkAuditRecord(communication, quote)).toMatchObject({
      kind: "QUOTE_LINK",
      missionId: "mission-demo",
      providerId: "provider-demo",
      communicationId: "comm-123",
      quoteId: "quote-123",
      quoteSource: "CALL",
      quoteSourceReference: "external-call-123"
    });
  });

  it("rejects cross-mission Quote audit links", () => {
    const quote = quoteSchema.parse({
      id: "quote-other",
      missionId: "mission-other",
      providerId: "provider-demo",
      available: true,
      source: "CALL",
      sourceReference: "external-call-123",
      createdAt: "2026-09-30T18:01:00.000Z"
    });

    expect(() => buildQuoteLinkAuditRecord(completedCommunication(), quote)).toThrow(
      "correlation mismatch"
    );
  });

  it("observes processed, duplicate and unknown-correlation partner events", async () => {
    const adapter = new MockCommunicationAdapter();
    const deduplicator = new InMemoryCommunicationEventDeduplicator();
    const auditSink = new InMemoryCommunicationAuditSink();
    const payload = {
      eventId: "event-observed",
      missionId: "mission-demo",
      providerId: "provider-demo",
      status: "completed",
      summary: "do not log this provider text",
      observation: { available: true, notes: "do not log this either" },
      occurredAt
    };
    const correlation = {
      missionId: "mission-demo",
      providerId: "provider-demo"
    };

    await processCommunicationEvent({
      eventId: "event-observed",
      payload,
      adapter,
      correlation,
      deduplicator,
      auditSink
    });
    await processCommunicationEvent({
      eventId: "event-observed",
      payload,
      adapter,
      correlation,
      deduplicator,
      auditSink
    });
    await processCommunicationEvent({
      eventId: "event-unknown",
      payload: { ...payload, eventId: "event-unknown" },
      adapter,
      deduplicator,
      auditSink
    });

    expect(auditSink.records.map((record) => record.kind)).toEqual([
      "COMMUNICATION_RESULT",
      "DUPLICATE_EVENT",
      "UNKNOWN_CORRELATION"
    ]);
    expect(JSON.stringify(auditSink.records)).not.toContain(
      "do not log this provider text"
    );
    expect(JSON.stringify(auditSink.records)).not.toContain(
      "do not log this either"
    );
  });

  it("does not fail provider event processing when telemetry delivery fails", async () => {
    const result = await processCommunicationEvent({
      eventId: "event-telemetry-failure",
      payload: {
        eventId: "event-telemetry-failure",
        missionId: "mission-demo",
        providerId: "provider-demo",
        status: "completed",
        occurredAt
      },
      adapter: new MockCommunicationAdapter(),
      correlation: {
        missionId: "mission-demo",
        providerId: "provider-demo"
      },
      deduplicator: new InMemoryCommunicationEventDeduplicator(),
      auditSink: {
        async write() {
          throw new Error("telemetry backend unavailable");
        }
      }
    });

    expect(result.kind).toBe("PROCESSED");
  });
});
