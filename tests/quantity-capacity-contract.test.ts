import { describe, expect, it } from "vitest";
import type { Mission, Provider, Quote } from "../lib/schemas";
import { evaluateCandidate } from "../lib/intelligence/constraints";
import { recommend } from "../lib/intelligence/recommendation";

const mission: Mission = {
  id: "mission-q",
  type: "PROCUREMENT",
  status: "COMPARING",
  rawRequest: "I need 20 yards of black Ankara delivered to Yaba tomorrow under ₦70,000.",
  item: "black Ankara",
  quantity: 20,
  unit: "yards",
  budget: 70000,
  location: "Yaba",
  deadline: "tomorrow",
  approvalRequired: true,
  createdAt: "2026-10-02T08:00:00.000Z"
};

const provider: Provider = {
  id: "provider-ade",
  name: "Ade Textiles",
  category: "Fabric",
  location: "Lagos",
  languages: ["English"],
  verified: true,
  active: true
};

const baseline: Quote = {
  id: "quote-q",
  missionId: mission.id,
  providerId: provider.id,
  available: true,
  quantity: 20,
  unit: "yards",
  price: 60000,
  deliveryFee: 3000,
  total: 63000,
  deliveryDate: "tomorrow",
  source: "CALL",
  sourceReference: "communication:q",
  createdAt: "2026-10-02T08:00:00.000Z"
};

function withQuote(patch: Partial<Quote>): Quote {
  return { ...baseline, ...patch };
}

describe("Quote quantity/capacity contract", () => {
  it("passes when provider confirms exactly the requested quantity", () => {
    const evaluation = evaluateCandidate(mission, provider, baseline);
    expect(evaluation.status).toBe("PASS");
    expect(recommend(mission, [provider], [baseline]).decisionStatus).toBe("READY");
  });

  it("passes when provider confirms more than the requested quantity", () => {
    const evaluation = evaluateCandidate(
      mission,
      provider,
      withQuote({ quantity: 25 })
    );
    expect(evaluation.status).toBe("PASS");
  });

  it("fails when provider-confirmed quantity is insufficient", () => {
    const evaluation = evaluateCandidate(
      mission,
      provider,
      withQuote({ quantity: 15 })
    );
    expect(evaluation.status).toBe("FAIL");
    expect(evaluation.exclusions.map((reason) => reason.code)).toContain(
      "QUANTITY_CAPACITY_INSUFFICIENT"
    );
  });

  it("stays unknown when no provider-confirmed quantity is represented", () => {
    const evaluation = evaluateCandidate(
      mission,
      provider,
      withQuote({ quantity: undefined, unit: undefined })
    );
    expect(evaluation.status).toBe("UNKNOWN");
    expect(evaluation.uncertainties.map((reason) => reason.code)).toContain(
      "QUANTITY_CAPACITY_UNKNOWN"
    );
    expect(
      recommend(mission, [provider], [withQuote({ quantity: undefined, unit: undefined })])
        .decisionStatus
    ).toBe("BLOCKED_UNKNOWN");
  });

  it("stays unknown when quantity has no unit but the Mission requires one", () => {
    const evaluation = evaluateCandidate(
      mission,
      provider,
      withQuote({ quantity: 20, unit: undefined })
    );
    expect(evaluation.status).toBe("UNKNOWN");
  });

  it("fails on incompatible units", () => {
    const evaluation = evaluateCandidate(
      mission,
      provider,
      withQuote({ quantity: 20, unit: "kg" })
    );
    expect(evaluation.status).toBe("FAIL");
    expect(evaluation.exclusions.map((reason) => reason.code)).toContain(
      "QUANTITY_UNIT_MISMATCH"
    );
  });

  it("treats simple singular/plural units as compatible", () => {
    const evaluation = evaluateCandidate(
      mission,
      provider,
      withQuote({ quantity: 20, unit: "yard" })
    );
    expect(evaluation.status).toBe("PASS");
  });
});
