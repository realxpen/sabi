import { describe, expect, it } from "vitest";
import { missionSchema } from "../lib/schemas";
import {
  buildIntelligenceDemoQuotes,
  intelligenceDemoProviders,
  recommend,
  retrieveKnowledge
} from "../lib/intelligence";

const mission = missionSchema.parse({
  id: "canonical-ankara-mission",
  type: "PROCUREMENT",
  status: "COMPARING",
  rawRequest: "I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.",
  item: "black Ankara",
  quantity: 20,
  unit: "yards",
  budget: 70000,
  location: "Yaba",
  deadline: "tomorrow",
  approvalRequired: true,
  createdAt: "2026-10-01T18:00:00.000Z"
});

describe("SABI intelligence recommendation", () => {
  it("selects the deterministic qualifying Ankara recommendation", () => {
    const result = recommend(
      mission,
      intelligenceDemoProviders,
      buildIntelligenceDemoQuotes(mission)
    );

    expect(result.selected?.provider.id).toBe("provider-ade-textiles");
    expect(result.selected?.quote.total).toBe(63000);
    expect(result.alternatives.map((candidate) => candidate.provider.id)).toEqual([
      "provider-tola-fabrics"
    ]);
    expect(result.approvalRequired).toBe(true);
  });

  it("excludes the cheaper quote when its deadline fails", () => {
    const result = recommend(
      mission,
      intelligenceDemoProviders,
      buildIntelligenceDemoQuotes(mission)
    );

    const late = result.exclusions.find((item) => item.quoteId === "quote-bola-late");
    expect(late?.reasons.map((reason) => reason.code)).toContain("DEADLINE_MISMATCH");
  });

  it("excludes over-budget options rather than relaxing the hard budget", () => {
    const result = recommend(
      mission,
      intelligenceDemoProviders,
      buildIntelligenceDemoQuotes(mission)
    );

    const overBudget = result.exclusions.find(
      (item) => item.quoteId === "quote-sade-over-budget"
    );
    expect(overBudget?.reasons.map((reason) => reason.code)).toContain("OVER_BUDGET");
  });

  it("keeps missing delivery fee and total unknown", () => {
    const result = recommend(
      mission,
      intelligenceDemoProviders,
      buildIntelligenceDemoQuotes(mission)
    );

    const missing = result.exclusions.find(
      (item) => item.quoteId === "quote-missing-delivery-fee"
    );
    expect(missing?.reasons.map((reason) => reason.code)).toContain("TOTAL_UNKNOWN");
  });

  it("returns no recommendation when every candidate is invalid", () => {
    const quotes = buildIntelligenceDemoQuotes(mission).map((quote) => ({
      ...quote,
      total: quote.total === undefined ? undefined : quote.total + 100000,
      deliveryDate: "next month"
    }));

    const result = recommend(mission, intelligenceDemoProviders, quotes);
    expect(result.selected).toBeUndefined();
    expect(result.alternatives).toEqual([]);
  });
});

describe("SABI Knowledge retrieval", () => {
  it("retrieves approval and procurement guidance with source provenance", () => {
    const knowledge = retrieveKnowledge(mission);

    expect(knowledge.map((entry) => entry.id)).toContain(
      "knowledge.approval.active"
    );
    expect(knowledge.map((entry) => entry.id)).toContain(
      "knowledge.procurement.active"
    );
    expect(knowledge.every((entry) => entry.status === "ACTIVE")).toBe(true);
    expect(knowledge.every((entry) => entry.source.length > 0)).toBe(true);
  });

  it("does not turn live provider facts into durable Knowledge", () => {
    const knowledge = retrieveKnowledge(mission);
    expect(knowledge.some((entry) => entry.content.includes("₦63,000"))).toBe(false);
    expect(knowledge.some((entry) => entry.content.includes("Ade Textiles"))).toBe(false);
  });
});
