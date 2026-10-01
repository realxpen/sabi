import { describe, expect, it } from "vitest";
import { normalizeProviderTranscript } from "../lib/intelligence";

describe("transcript currency parsing", () => {
  it("does not double-count a currency-marked contextual product price", () => {
    const result = normalizeProviderTranscript([
      { speaker: "SABI", text: "How much does the fabric cost?" },
      { speaker: "PROVIDER", text: "₦60,000" }
    ]);

    expect(result.observation?.price).toBe(60000);
    expect(result.ambiguities.map((item) => item.code)).not.toContain(
      "CONFLICTING_PRICE"
    );
  });

  it("does not double-count a currency-marked contextual delivery fee", () => {
    const result = normalizeProviderTranscript([
      { speaker: "SABI", text: "How much is the delivery fee?" },
      { speaker: "PROVIDER", text: "₦3,000" }
    ]);

    expect(result.observation?.deliveryFee).toBe(3000);
    expect(result.ambiguities.map((item) => item.code)).not.toContain(
      "CONFLICTING_DELIVERY_FEE"
    );
  });
});
