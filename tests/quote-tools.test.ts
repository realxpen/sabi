import { describe, expect, it } from "vitest";
import { recordQuote } from "../lib/tools/quote-tools";

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
