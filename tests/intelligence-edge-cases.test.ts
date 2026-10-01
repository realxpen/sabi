import { describe, expect, it } from "vitest";
import {
  communicationResultSchema,
  missionSchema,
  quoteSchema
} from "../lib/schemas";
import {
  assembleMissionContext,
  buildIntelligenceDemoQuotes,
  evaluateCandidate,
  intelligenceDemoProviders,
  recommend
} from "../lib/intelligence";

const baseMission = missionSchema.parse({
  id: "edge-case-mission",
  type: "PROCUREMENT",
  status: "COMPARING",
  rawRequest: "I need black Ankara delivered to Yaba tomorrow under ₦70,000.",
  item: "black Ankara",
  budget: 70000,
  location: "Yaba",
  deadline: "tomorrow",
  approvalRequired: true,
  createdAt: "2026-10-01T18:00:00.000Z"
});

const ade = intelligenceDemoProviders.find(
  (provider) => provider.id === "provider-ade-textiles"
)!;

describe("F8 factual uncertainty edge cases", () => {
  it("does not guess a missing price or total", () => {
    const quote = quoteSchema.parse({
      id: "quote-missing-price",
      missionId: baseMission.id,
      providerId: ade.id,
      available: true,
      deliveryFee: 3000,
      deliveryDate: "tomorrow",
      source: "CALL",
      sourceReference: "edge-missing-price",
      createdAt: "2026-10-01T18:01:00.000Z"
    });

    const evaluation = evaluateCandidate(baseMission, ade, quote);

    expect(quote.price).toBeUndefined();
    expect(quote.total).toBeUndefined();
    expect(evaluation.status).toBe("UNKNOWN");
    expect(evaluation.uncertainties.map((reason) => reason.code)).toContain(
      "TOTAL_UNKNOWN"
    );
    expect(evaluation.uncertainties.map((reason) => reason.code)).toContain(
      "BUDGET_UNVERIFIED"
    );
  });

  it("keeps a missing delivery date unknown when the Mission has a hard deadline", () => {
    const quote = quoteSchema.parse({
      id: "quote-missing-delivery-date",
      missionId: baseMission.id,
      providerId: ade.id,
      available: true,
      price: 60000,
      deliveryFee: 3000,
      total: 63000,
      source: "CALL",
      sourceReference: "edge-missing-delivery-date",
      createdAt: "2026-10-01T18:02:00.000Z"
    });

    const evaluation = evaluateCandidate(baseMission, ade, quote);

    expect(evaluation.status).toBe("UNKNOWN");
    expect(evaluation.uncertainties.map((reason) => reason.code)).toContain(
      "DEADLINE_UNKNOWN"
    );
  });

  it("returns no valid option when every supplied factual total is over budget", () => {
    const tightBudgetMission = missionSchema.parse({
      ...baseMission,
      id: "all-over-budget-mission",
      budget: 50000
    });
    const knownQuotes = buildIntelligenceDemoQuotes(tightBudgetMission).filter(
      (quote) => quote.total !== undefined
    );

    const result = recommend(
      tightBudgetMission,
      intelligenceDemoProviders,
      knownQuotes
    );

    expect(result.decisionStatus).toBe("NO_VALID_OPTIONS");
    expect(result.selected).toBeUndefined();
    expect(result.exclusions.length).toBe(knownQuotes.length);
  });

  it("keeps an incomplete communication observation out of Quote truth", () => {
    const communication = communicationResultSchema.parse({
      id: "communication-incomplete",
      missionId: baseMission.id,
      providerId: ade.id,
      channel: "CALL",
      status: "COMPLETED",
      summary: "Provider answered, but price and delivery facts were not captured.",
      observation: {
        notes: "Needs factual follow-up before Quote normalization."
      },
      occurredAt: "2026-10-01T18:03:00.000Z"
    });

    const context = assembleMissionContext(baseMission, [ade], [], {
      communicationObservations: [communication]
    });

    expect(context.communicationObservations).toHaveLength(1);
    expect(context.communicationObservations[0].observation?.price).toBeUndefined();
    expect(context.communicationObservations[0].observation?.deliveryDate).toBeUndefined();
    expect(context.operationalData.quotes).toEqual([]);
  });
});
