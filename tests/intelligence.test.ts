import { describe, expect, it } from "vitest";
import { missionSchema, quoteSchema } from "../lib/schemas";
import {
  assembleMissionContext,
  buildIntelligenceDemoQuotes,
  evaluateCandidate,
  intelligenceDemoCommunications,
  intelligenceDemoProviders,
  recommend,
  retrieveKnowledge
} from "../lib/intelligence";

const mission = missionSchema.parse({
  id: "canonical-ankara-mission",
  type: "PROCUREMENT",
  status: "COMPARING",
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

const missionWithoutQuantity = missionSchema.parse({
  ...mission,
  id: "ankara-without-capacity-constraint",
  quantity: undefined,
  unit: undefined
});

function quotesFor(targetMission = mission) {
  return buildIntelligenceDemoQuotes(targetMission);
}

describe("SABI hard constraints", () => {
  it("does not treat unrepresented quantity/capacity as a pass", () => {
    const quote = quotesFor(mission)[0];
    const provider = intelligenceDemoProviders.find(
      (item) => item.id === quote.providerId
    );
    expect(provider).toBeDefined();

    const evaluation = evaluateCandidate(mission, provider!, quote);
    const capacityCheck = evaluation.checks.find(
      (check) => check.code === "QUANTITY_CAPACITY"
    );

    expect(capacityCheck?.status).toBe("UNKNOWN");
    expect(evaluation.status).toBe("UNKNOWN");
    expect(evaluation.qualifies).toBe(false);
    expect(evaluation.uncertainties.map((reason) => reason.code)).toContain(
      "QUANTITY_CAPACITY_UNKNOWN"
    );
  });

  it("passes the same candidate when no quantity/capacity constraint is represented", () => {
    const quote = quotesFor(missionWithoutQuantity)[0];
    const provider = intelligenceDemoProviders.find(
      (item) => item.id === quote.providerId
    );
    expect(provider).toBeDefined();

    const evaluation = evaluateCandidate(
      missionWithoutQuantity,
      provider!,
      quote
    );
    expect(evaluation.status).toBe("PASS");
    expect(evaluation.qualifies).toBe(true);
  });

  it("fails a deadline conflict instead of allowing a cheaper quote through", () => {
    const result = recommend(
      missionWithoutQuantity,
      intelligenceDemoProviders,
      quotesFor(missionWithoutQuantity)
    );
    const late = result.exclusions.find(
      (item) => item.quoteId === "quote-bola-late"
    );
    expect(late?.reasons.map((reason) => reason.code)).toContain(
      "DEADLINE_MISMATCH"
    );
  });

  it("fails an over-budget option without relaxing the hard budget", () => {
    const result = recommend(
      missionWithoutQuantity,
      intelligenceDemoProviders,
      quotesFor(missionWithoutQuantity)
    );
    const overBudget = result.exclusions.find(
      (item) => item.quoteId === "quote-sade-over-budget"
    );
    expect(overBudget?.reasons.map((reason) => reason.code)).toContain(
      "OVER_BUDGET"
    );
  });

  it("keeps missing total factual uncertainty separate from hard failure", () => {
    const result = recommend(
      missionWithoutQuantity,
      intelligenceDemoProviders,
      quotesFor(missionWithoutQuantity)
    );
    const missing = result.uncertainties.find(
      (item) => item.quoteId === "quote-missing-delivery-fee"
    );

    expect(missing?.reasons.map((reason) => reason.code)).toContain(
      "TOTAL_UNKNOWN"
    );
    expect(missing?.reasons.map((reason) => reason.code)).toContain(
      "BUDGET_UNVERIFIED"
    );
    expect(
      result.exclusions.some(
        (item) => item.quoteId === "quote-missing-delivery-fee"
      )
    ).toBe(false);
  });

  it("fails an unavailable provider", () => {
    const result = recommend(
      missionWithoutQuantity,
      intelligenceDemoProviders,
      quotesFor(missionWithoutQuantity)
    );
    const unavailable = result.exclusions.find(
      (item) => item.quoteId === "quote-unavailable-provider"
    );
    expect(unavailable?.reasons.map((reason) => reason.code)).toContain(
      "PROVIDER_UNAVAILABLE"
    );
  });

  it("fails the wrong provider category", () => {
    const wrongProvider = intelligenceDemoProviders.find(
      (provider) => provider.id === "provider-wrong-category"
    );
    expect(wrongProvider).toBeDefined();

    const quote = quoteSchema.parse({
      ...quotesFor(missionWithoutQuantity)[0],
      id: "quote-wrong-category",
      providerId: "provider-wrong-category"
    });
    const evaluation = evaluateCandidate(
      missionWithoutQuantity,
      wrongProvider!,
      quote
    );

    expect(evaluation.status).toBe("FAIL");
    expect(evaluation.exclusions.map((reason) => reason.code)).toContain(
      "ITEM_CATEGORY_MISMATCH"
    );
  });
});

describe("SABI recommendation output", () => {
  it("blocks the canonical Ankara recommendation while quantity capacity is unknown", () => {
    const result = recommend(
      mission,
      intelligenceDemoProviders,
      quotesFor(mission)
    );

    expect(result.decisionStatus).toBe("BLOCKED_UNKNOWN");
    expect(result.selected).toBeUndefined();
    expect(result.pendingEvidence[0]?.provider.id).toBe(
      "provider-ade-textiles"
    );
    expect(result.pendingEvidence[0]?.quote.total).toBe(63000);
    expect(result.requiredFacts.some((fact) => fact.includes("20 yards"))).toBe(
      true
    );
  });

  it("selects Ade deterministically when all represented hard constraints pass", () => {
    const result = recommend(
      missionWithoutQuantity,
      intelligenceDemoProviders,
      quotesFor(missionWithoutQuantity)
    );

    expect(result.decisionStatus).toBe("READY");
    expect(result.selected?.provider.id).toBe("provider-ade-textiles");
    expect(result.selected?.quote.total).toBe(63000);
    expect(result.alternatives.map((candidate) => candidate.provider.id)).toEqual([
      "provider-tola-fabrics"
    ]);
    expect(result.approvalRequired).toBe(true);
  });

  it("returns source provenance for every evaluated Quote", () => {
    const result = recommend(
      missionWithoutQuantity,
      intelligenceDemoProviders,
      quotesFor(missionWithoutQuantity)
    );
    const bola = result.provenance.find(
      (item) => item.quoteId === "quote-bola-late"
    );
    expect(bola?.source).toBe("CALL");
    expect(bola?.sourceReference).toBe("demo-call-bola-late");
  });

  it("returns no recommendation when every candidate fails", () => {
    const invalidQuotes = quotesFor(missionWithoutQuantity).map((quote) => ({
      ...quote,
      total: quote.total === undefined ? undefined : quote.total + 100000,
      deliveryDate: "next month"
    }));

    const result = recommend(
      missionWithoutQuantity,
      intelligenceDemoProviders,
      invalidQuotes
    );
    expect(result.decisionStatus).toBe("NO_VALID_OPTIONS");
    expect(result.selected).toBeUndefined();
    expect(result.alternatives).toEqual([]);
    expect(result.pendingEvidence).toEqual([]);
  });

  it("is deterministic across repeated runs", () => {
    const quotes = quotesFor(missionWithoutQuantity);
    const first = recommend(
      missionWithoutQuantity,
      intelligenceDemoProviders,
      quotes
    );
    const second = recommend(
      missionWithoutQuantity,
      intelligenceDemoProviders,
      quotes
    );

    expect(first.selected?.quote.id).toBe(second.selected?.quote.id);
    expect(first.alternatives.map((item) => item.quote.id)).toEqual(
      second.alternatives.map((item) => item.quote.id)
    );
  });

  it("does not rank on fields outside the documented factor set", () => {
    const result = recommend(
      missionWithoutQuantity,
      intelligenceDemoProviders,
      quotesFor(missionWithoutQuantity)
    );
    expect(result.selected?.factors.map((factor) => factor.code)).toEqual([
      "TOTAL_PRICE",
      "VERIFICATION",
      "RELIABILITY",
      "RATING"
    ]);
  });

  it("preserves the mission approval requirement rather than inventing one", () => {
    const noApprovalMission = missionSchema.parse({
      ...missionWithoutQuantity,
      id: "mission-no-approval",
      approvalRequired: false
    });
    const result = recommend(
      noApprovalMission,
      intelligenceDemoProviders,
      quotesFor(noApprovalMission)
    );
    expect(result.approvalRequired).toBe(false);
  });
});

describe("SABI communication truthfulness", () => {
  it("keeps no-answer communication separate from Quote data", () => {
    expect(intelligenceDemoCommunications).toHaveLength(1);
    expect(intelligenceDemoCommunications[0].status).toBe("NO_ANSWER");
    expect(
      quotesFor(mission).some(
        (quote) => quote.id === intelligenceDemoCommunications[0].id
      )
    ).toBe(false);
  });
});

describe("SABI Knowledge retrieval and context separation", () => {
  it("retrieves ACTIVE approval, procurement and truthfulness guidance with provenance", () => {
    const knowledge = retrieveKnowledge(mission);
    const ids = knowledge.map((entry) => entry.id);

    expect(ids).toContain("knowledge.approval.active");
    expect(ids).toContain("knowledge.procurement.active");
    expect(ids).toContain("knowledge.truthfulness.active");
    expect(knowledge.every((entry) => entry.lifecycle === "ACTIVE")).toBe(true);
    expect(knowledge.every((entry) => entry.sourceId.length > 0)).toBe(true);
    expect(knowledge.every((entry) => entry.source.length > 0)).toBe(true);
  });

  it("does not retrieve irrelevant trust or communication guidance by default", () => {
    const knowledge = retrieveKnowledge(mission);
    expect(knowledge.map((entry) => entry.topic)).not.toContain("TRUST");
    expect(knowledge.map((entry) => entry.topic)).not.toContain(
      "COMMUNICATION"
    );
  });

  it("returns explicitly requested policy even when its keywords are absent from the Mission text", () => {
    const knowledge = retrieveKnowledge(mission, ["COMMUNICATION"]);
    expect(knowledge.map((entry) => entry.id)).toEqual([
      "knowledge.communication.active"
    ]);
  });

  it("does not turn live provider facts into durable Knowledge", () => {
    const knowledge = retrieveKnowledge(mission);
    expect(knowledge.some((entry) => entry.content.includes("₦63,000"))).toBe(
      false
    );
    expect(knowledge.some((entry) => entry.content.includes("Ade Textiles"))).toBe(
      false
    );
  });

  it("keeps durable Knowledge, operational facts, communication observations and memory in separate context lanes", () => {
    const context = assembleMissionContext(
      mission,
      intelligenceDemoProviders,
      quotesFor(mission),
      {
        communicationObservations: intelligenceDemoCommunications,
        userMemory: [
          {
            id: "memory-explicit-1",
            source: "EXPLICIT",
            content: "User prefers black Ankara."
          }
        ]
      }
    );

    expect(context.durableKnowledge.length).toBeGreaterThan(0);
    expect(context.operationalData.quotes[0].total).toBe(63000);
    expect(context.communicationObservations[0].status).toBe("NO_ANSWER");
    expect(context.userMemory[0].source).toBe("EXPLICIT");
    expect(
      context.durableKnowledge.some((entry) => entry.content.includes("63000"))
    ).toBe(false);
    expect(
      context.provenance.quoteSources.some(
        (item) => item.sourceReference === "demo-call-bola-late"
      )
    ).toBe(true);
  });
});
