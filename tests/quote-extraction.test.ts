import { describe, expect, it } from "vitest";
import {
  communicationResultSchema,
  missionSchema,
  type CommunicationResult
} from "../lib/schemas";
import {
  extractQuoteFromCommunication,
  extractQuotesFromCommunications
} from "../lib/intelligence";

const mission = missionSchema.parse({
  id: "mission-quote-extraction",
  type: "PROCUREMENT",
  status: "COLLECTING_QUOTES",
  rawRequest:
    "I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.",
  item: "black Ankara",
  quantity: 20,
  unit: "yards",
  budget: 70000,
  location: "Yaba",
  deadline: "tomorrow",
  approvalRequired: true,
  createdAt: "2026-10-01T18:00:00.000Z"
});

function communication(
  input: Partial<CommunicationResult> &
    Pick<CommunicationResult, "id" | "status">
): CommunicationResult {
  return communicationResultSchema.parse({
    missionId: mission.id,
    providerId: "provider-ade-textiles",
    channel: "CALL",
    occurredAt: "2026-10-01T18:30:00.000Z",
    ...input
  });
}

describe("extractQuoteFromCommunication", () => {
  it("creates a source-traceable Quote from completed structured evidence", () => {
    const result = extractQuoteFromCommunication(
      communication({
        id: "communication-complete",
        status: "COMPLETED",
        externalId: "kros-call-123",
        observation: {
          available: true,
          price: 60000,
          deliveryFee: 3000,
          deliveryDate: "tomorrow",
          notes: "Black Ankara is available."
        }
      }),
      {
        mission,
        quoteId: "quote-from-call",
        createdAt: "2026-10-01T18:31:00.000Z"
      }
    );

    expect(result.status).toBe("QUOTE_CREATED");
    expect(result.quote).toEqual(
      expect.objectContaining({
        id: "quote-from-call",
        missionId: mission.id,
        providerId: "provider-ade-textiles",
        available: true,
        price: 60000,
        deliveryFee: 3000,
        total: 63000,
        deliveryDate: "tomorrow",
        source: "CALL",
        sourceReference: "communication:communication-complete"
      })
    );
    expect(result.provenance.externalId).toBe("kros-call-123");
    expect(
      result.observedFacts.find((fact) => fact.code === "TOTAL")?.derived
    ).toBe(true);
  });

  it("creates a partial Quote but keeps fee and total unknown instead of assuming zero", () => {
    const result = extractQuoteFromCommunication(
      communication({
        id: "communication-missing-fee",
        status: "COMPLETED",
        observation: {
          available: true,
          price: 62000,
          deliveryDate: "tomorrow"
        }
      }),
      { mission }
    );

    expect(result.status).toBe("QUOTE_CREATED");
    expect(result.quote?.price).toBe(62000);
    expect(result.quote?.deliveryFee).toBeUndefined();
    expect(result.quote?.total).toBeUndefined();
    expect(result.missingFacts.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "DELIVERY_FEE_UNKNOWN",
        "TOTAL_UNKNOWN",
        "QUANTITY_CAPACITY_UNREPRESENTED"
      ])
    );
  });

  it("does not create a Quote when required availability evidence is absent", () => {
    const result = extractQuoteFromCommunication(
      communication({
        id: "communication-no-availability",
        status: "COMPLETED",
        observation: {
          price: 60000,
          deliveryFee: 3000,
          deliveryDate: "tomorrow"
        }
      }),
      { mission }
    );

    expect(result.status).toBe("INCOMPLETE");
    expect(result.quote).toBeUndefined();
    expect(result.observedFacts.map((fact) => fact.code)).toContain("PRICE");
    expect(result.missingFacts).toContainEqual(
      expect.objectContaining({
        code: "AVAILABILITY_UNKNOWN",
        blocksQuoteCreation: true
      })
    );
  });

  it("never parses provider facts out of a summary when structured observation is absent", () => {
    const result = extractQuoteFromCommunication(
      communication({
        id: "communication-summary-only",
        status: "COMPLETED",
        summary: "Available for ₦60,000 plus ₦3,000 delivery tomorrow."
      }),
      { mission }
    );

    expect(result.status).toBe("INCOMPLETE");
    expect(result.quote).toBeUndefined();
    expect(result.observedFacts).toEqual([]);
    expect(result.missingFacts.map((item) => item.code)).toEqual(
      expect.arrayContaining(["OBSERVATION_MISSING", "AVAILABILITY_UNKNOWN"])
    );
  });

  it("keeps NO_ANSWER as communication evidence and never fabricates a Quote", () => {
    const result = extractQuoteFromCommunication(
      communication({
        id: "communication-no-answer-extraction",
        status: "NO_ANSWER",
        summary: "Provider did not answer."
      }),
      { mission }
    );

    expect(result.status).toBe("NOT_QUOTABLE");
    expect(result.quote).toBeUndefined();
    expect(result.missingFacts).toContainEqual(
      expect.objectContaining({ code: "COMMUNICATION_NOT_COMPLETED" })
    );
  });

  it("creates an unavailable Quote only when unavailability is explicit provider observation", () => {
    const result = extractQuoteFromCommunication(
      communication({
        id: "communication-explicit-unavailable",
        status: "COMPLETED",
        observation: {
          available: false,
          notes: "Requested fabric is out of stock."
        }
      }),
      { mission }
    );

    expect(result.status).toBe("QUOTE_CREATED");
    expect(result.quote?.available).toBe(false);
    expect(result.quote?.price).toBeUndefined();
    expect(result.quote?.deliveryFee).toBeUndefined();
    expect(result.quote?.total).toBeUndefined();
    expect(result.missingFacts).toEqual([]);
  });

  it("reports the shared quantity/capacity representation gap without blocking Quote creation", () => {
    const result = extractQuoteFromCommunication(
      communication({
        id: "communication-quantity-gap",
        status: "COMPLETED",
        observation: {
          available: true,
          price: 60000,
          deliveryFee: 3000,
          deliveryDate: "tomorrow"
        }
      }),
      { mission }
    );

    expect(result.quote).toBeDefined();
    expect(result.missingFacts).toContainEqual(
      expect.objectContaining({
        code: "QUANTITY_CAPACITY_UNREPRESENTED",
        blocksQuoteCreation: false
      })
    );
  });

  it("maps SMS evidence to Quote source SMS", () => {
    const result = extractQuoteFromCommunication(
      communication({
        id: "communication-sms",
        channel: "SMS",
        status: "COMPLETED",
        observation: {
          available: true,
          price: 60000,
          deliveryFee: 0,
          deliveryDate: "tomorrow"
        }
      }),
      { createdAt: "2026-10-01T18:31:00.000Z" }
    );

    expect(result.quote?.source).toBe("SMS");
    expect(result.quote?.total).toBe(60000);
    expect(result.needsFollowUp).toBe(false);
  });

  it("rejects evidence attached to a different Mission", () => {
    const result = extractQuoteFromCommunication(
      communication({
        id: "communication-wrong-mission",
        missionId: "another-mission",
        status: "COMPLETED",
        observation: { available: true }
      }),
      { mission }
    );

    expect(result.status).toBe("NOT_QUOTABLE");
    expect(result.quote).toBeUndefined();
    expect(result.missingFacts).toContainEqual(
      expect.objectContaining({
        code: "MISSION_MISMATCH",
        blocksQuoteCreation: true
      })
    );
  });
});

describe("extractQuotesFromCommunications", () => {
  it("returns created Quotes separately from unresolved communication evidence", () => {
    const complete = communication({
      id: "communication-batch-complete",
      status: "COMPLETED",
      observation: {
        available: true,
        price: 60000,
        deliveryFee: 3000,
        deliveryDate: "tomorrow"
      }
    });
    const noAnswer = communication({
      id: "communication-batch-no-answer",
      providerId: "provider-tola-fabrics",
      status: "NO_ANSWER"
    });

    const batch = extractQuotesFromCommunications([complete, noAnswer], {
      createdAt: "2026-10-01T18:31:00.000Z"
    });

    expect(batch.quotes).toHaveLength(1);
    expect(batch.quotes[0].id).toBe("quote-communication-batch-complete");
    expect(batch.results).toHaveLength(2);
    expect(batch.followUps).toHaveLength(1);
    expect(batch.followUps[0].provenance.communicationId).toBe(
      "communication-batch-no-answer"
    );
  });
});
