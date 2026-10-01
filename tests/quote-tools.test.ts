import { describe, expect, it } from "vitest";
import {
  recordQuote,
  recordQuoteFromCommunication
} from "../lib/tools/quote-tools";

describe("recordQuote", () => {
  it("returns a canonical quote from factual input", () => {
    const quote = recordQuote({
      missionId: "mission-demo",
      providerId: "provider-tola-fabrics",
      available: true,
      price: 64000,
      deliveryFee: 3000,
      total: 67000,
      deliveryDate: "tomorrow",
      source: "CALL",
      sourceReference: "communication-call-1"
    });

    expect(quote.id).toMatch(/^quote-/);
    expect(quote.missionId).toBe("mission-demo");
    expect(quote.providerId).toBe("provider-tola-fabrics");
    expect(quote.sourceReference).toBe("communication-call-1");
  });

  it("does not invent a missing delivery fee or total", () => {
    const quote = recordQuote({
      missionId: "mission-demo",
      providerId: "provider-tola-fabrics",
      available: true,
      price: 64000,
      source: "SMS",
      sourceReference: "communication-sms-1"
    });

    expect(quote.price).toBe(64000);
    expect(quote.deliveryFee).toBeUndefined();
    expect(quote.total).toBeUndefined();
  });

  it("supports an unavailable factual quote without inventing commercial values", () => {
    const quote = recordQuote({
      missionId: "mission-demo",
      providerId: "provider-mariam-fabrics",
      available: false,
      notes: "Requested quantity is unavailable.",
      source: "CALL",
      sourceReference: "communication-call-2"
    });

    expect(quote.available).toBe(false);
    expect(quote.price).toBeUndefined();
    expect(quote.total).toBeUndefined();
  });

  it("normalizes Bimpe JSON-template scalar strings safely", () => {
    const quote = recordQuote({
      missionId: "mission-bimpe",
      providerId: "provider-ade-textiles",
      available: "false" as unknown as boolean,
      price: "60000" as unknown as number,
      deliveryFee: "" as unknown as number,
      total: "" as unknown as number,
      deliveryDate: "" as unknown as string,
      notes: "Bimpe template input",
      source: "MANUAL",
      sourceReference: "bimpe-template-test"
    });

    expect(quote.available).toBe(false);
    expect(quote.price).toBe(60000);
    expect(quote.deliveryFee).toBeUndefined();
    expect(quote.total).toBeUndefined();
    expect(quote.deliveryDate).toBeUndefined();
  });

  it("treats unresolved optional Bimpe placeholders as unknown", () => {
    const quote = recordQuote({
      missionId: "mission-bimpe-placeholder",
      providerId: "provider-ade-textiles",
      available: "true" as unknown as boolean,
      price: "{{price}}" as unknown as number,
      deliveryFee: "{{deliveryFee}}" as unknown as number,
      total: "{{total}}" as unknown as number,
      deliveryDate: "{{deliveryDate}}",
      notes: "{{notes}}",
      source: "MANUAL",
      sourceReference: "{{sourceReference}}"
    });

    expect(quote.available).toBe(true);
    expect(quote.price).toBeUndefined();
    expect(quote.deliveryFee).toBeUndefined();
    expect(quote.total).toBeUndefined();
    expect(quote.deliveryDate).toBeUndefined();
    expect(quote.notes).toBeUndefined();
    expect(quote.sourceReference).toBeUndefined();
  });

  it("rejects an unknown provider", () => {
    expect(() =>
      recordQuote({
        missionId: "mission-demo",
        providerId: "provider-missing",
        available: true,
        price: 1000,
        source: "MANUAL"
      })
    ).toThrow("Provider not found");
  });
});

describe("recordQuoteFromCommunication", () => {
  it("creates a source-traceable quote from completed availability evidence", () => {
    const quote = recordQuoteFromCommunication({
      id: "communication-call-3",
      missionId: "mission-demo",
      providerId: "provider-tola-fabrics",
      channel: "CALL",
      status: "COMPLETED",
      externalId: "external-call-123",
      observation: {
        available: true,
        price: 64000,
        deliveryDate: "tomorrow"
      },
      occurredAt: "2026-09-30T12:00:00.000Z"
    });

    expect(quote?.available).toBe(true);
    expect(quote?.price).toBe(64000);
    expect(quote?.source).toBe("CALL");
    expect(quote?.sourceReference).toBe("external-call-123");
    expect(quote?.deliveryFee).toBeUndefined();
    expect(quote?.total).toBeUndefined();
  });

  it.each(["NO_ANSWER", "UNAVAILABLE", "FAILED", "INITIATED", "IN_PROGRESS"] as const)(
    "does not create a quote from %s communication",
    (status) => {
      const quote = recordQuoteFromCommunication({
        id: `communication-${status.toLowerCase()}`,
        missionId: "mission-demo",
        providerId: "provider-tola-fabrics",
        channel: "CALL",
        status,
        occurredAt: "2026-09-30T12:00:00.000Z"
      });

      expect(quote).toBeUndefined();
    }
  );

  it("does not treat a completed but incomplete result as a Quote", () => {
    const quote = recordQuoteFromCommunication({
      id: "communication-incomplete",
      missionId: "mission-demo",
      providerId: "provider-tola-fabrics",
      channel: "CALL",
      status: "COMPLETED",
      observation: {
        notes: "Transcript existed but availability was not confirmed."
      },
      occurredAt: "2026-09-30T12:00:00.000Z"
    });

    expect(quote).toBeUndefined();
  });
});
