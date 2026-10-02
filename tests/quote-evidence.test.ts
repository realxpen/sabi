import { describe, expect, it } from "vitest";
import { communicationResultSchema } from "../lib/schemas";
import { quoteFromCommunicationEvidence } from "../lib/mission/quote-evidence";

describe("structured communication quote evidence", () => {
  it("creates a source-traceable Quote only from explicit completed observations", () => {
    const communication = communicationResultSchema.parse({
      id: "communication-1",
      missionId: "mission-1",
      providerId: "provider-1",
      channel: "CALL",
      status: "COMPLETED",
      externalId: "vapi-call-1",
      summary: "Provider call completed.",
      observation: {
        available: true,
        price: 60000,
        deliveryFee: 3000,
        deliveryDate: "tomorrow"
      },
      occurredAt: "2026-10-02T08:00:00.000Z"
    });

    const quote = quoteFromCommunicationEvidence(communication);

    expect(quote).toMatchObject({
      id: "quote-communication-1",
      missionId: "mission-1",
      providerId: "provider-1",
      available: true,
      price: 60000,
      deliveryFee: 3000,
      total: 63000,
      deliveryDate: "tomorrow",
      source: "CALL",
      sourceReference: "vapi-call-1"
    });
  });

  it("does not create a Quote from a completed transcript/summary alone", () => {
    const communication = communicationResultSchema.parse({
      id: "communication-2",
      missionId: "mission-1",
      providerId: "provider-1",
      channel: "CALL",
      status: "COMPLETED",
      summary: "Provider mentioned a price in the conversation.",
      occurredAt: "2026-10-02T08:00:00.000Z"
    });

    expect(quoteFromCommunicationEvidence(communication)).toBeUndefined();
  });

  it("does not create a Quote from no-answer or failed communication", () => {
    for (const status of ["NO_ANSWER", "FAILED"] as const) {
      const communication = communicationResultSchema.parse({
        id: `communication-${status}`,
        missionId: "mission-1",
        providerId: "provider-1",
        channel: "CALL",
        status,
        observation: {
          available: true,
          price: 1000,
          deliveryFee: 100
        },
        occurredAt: "2026-10-02T08:00:00.000Z"
      });

      expect(quoteFromCommunicationEvidence(communication)).toBeUndefined();
    }
  });

  it("keeps total unknown when either commercial component is unknown", () => {
    const communication = communicationResultSchema.parse({
      id: "communication-partial",
      missionId: "mission-1",
      providerId: "provider-1",
      channel: "SMS",
      status: "COMPLETED",
      observation: {
        available: true,
        price: 60000,
        deliveryDate: "tomorrow"
      },
      occurredAt: "2026-10-02T08:00:00.000Z"
    });

    const quote = quoteFromCommunicationEvidence(communication);
    expect(quote?.price).toBe(60000);
    expect(quote?.deliveryFee).toBeUndefined();
    expect(quote?.total).toBeUndefined();
  });
});
