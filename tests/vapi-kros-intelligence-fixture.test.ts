import { describe, expect, it } from "vitest";
import { missionSchema } from "../lib/schemas";
import {
  buildCanonicalAnkaraVapiKrosFixturePayloads,
  intelligenceDemoProviders,
  projectVerifiedVapiKrosFixture,
  runVapiKrosIntelligenceFixture
} from "../lib/intelligence";

const mission = missionSchema.parse({
  id: "canonical-ankara-mission",
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
  createdAt: "2026-10-02T07:30:00.000Z"
});

describe("Vapi/Kros intelligence integration fixture", () => {
  it("projects Lara's end-of-call event shape without turning transcript into Quote truth", () => {
    const [adePayload] = buildCanonicalAnkaraVapiKrosFixturePayloads(
      mission.id
    );
    const projected = projectVerifiedVapiKrosFixture(adePayload);

    expect(projected.communication).toEqual(
      expect.objectContaining({
        id: "communication-vapi-ade",
        missionId: mission.id,
        providerId: "provider-ade-textiles",
        channel: "CALL",
        status: "COMPLETED",
        externalId: "vapi-call-ade",
        occurredAt: "2026-10-02T08:00:00.000Z"
      })
    );
    expect(projected.communication.observation).toBeUndefined();
    expect(projected.transcript).toContain("User: ₦60,000.");
  });

  it("runs raw Lara-shaped events through transcript observation, Quote extraction and READY recommendation", () => {
    const run = runVapiKrosIntelligenceFixture({
      mission,
      providers: intelligenceDemoProviders,
      payloads: buildCanonicalAnkaraVapiKrosFixturePayloads(mission.id)
    });

    expect(run.events).toHaveLength(5);
    expect(run.quotes).toHaveLength(4);

    const ade = run.events.find(
      (event) => event.communication.providerId === "provider-ade-textiles"
    );
    expect(ade?.normalization?.observationApplied).toBe(true);
    expect(ade?.normalizedCommunication.observation).toEqual({
      available: true,
      price: 60000,
      deliveryFee: 3000,
      deliveryDate: "tomorrow"
    });
    expect(ade?.normalization?.normalization.unrepresentedQuantityEvidence).toEqual(
      expect.objectContaining({ quantity: 20, unit: "yards" })
    );
    expect(ade?.extraction.status).toBe("QUOTE_CREATED");
    expect(ade?.extraction.quote).toEqual(
      expect.objectContaining({
        providerId: "provider-ade-textiles",
        quantity: 20,
        unit: "yards",
        price: 60000,
        deliveryFee: 3000,
        total: 63000,
        deliveryDate: "tomorrow",
        source: "CALL",
        sourceReference: "communication:communication-vapi-ade"
      })
    );
    expect(
      ade?.extraction.missingFacts.some(
        (fact) => fact.code === "QUANTITY_CAPACITY_UNREPRESENTED"
      )
    ).toBe(false);

    const tola = run.events.find(
      (event) => event.communication.providerId === "provider-tola-fabrics"
    );
    expect(tola?.transcript).toContain("User: 64k.");
    expect(tola?.extraction.quote).toEqual(
      expect.objectContaining({ total: 67000, quantity: 20, unit: "yards" })
    );

    const bola = run.events.find(
      (event) => event.communication.providerId === "provider-bola-textiles"
    );
    expect(bola?.extraction.quote).toEqual(
      expect.objectContaining({
        total: 57000,
        quantity: 20,
        unit: "yards",
        deliveryDate: "friday"
      })
    );

    const sade = run.events.find(
      (event) => event.communication.providerId === "provider-sade-fabrics"
    );
    expect(sade?.extraction.quote).toEqual(
      expect.objectContaining({ total: 79000, quantity: 20, unit: "yards" })
    );

    const noAnswer = run.events.find(
      (event) => event.communication.providerId === "provider-mariam-fabrics"
    );
    expect(noAnswer?.communication.status).toBe("NO_ANSWER");
    expect(noAnswer?.normalization).toBeUndefined();
    expect(noAnswer?.extraction.status).toBe("NOT_QUOTABLE");
    expect(noAnswer?.extraction.quote).toBeUndefined();
    expect(noAnswer?.extraction.missingFacts).toContainEqual(
      expect.objectContaining({ code: "COMMUNICATION_NOT_COMPLETED" })
    );

    expect(run.recommendation.decisionStatus).toBe("READY");
    expect(run.recommendation.selected?.provider.id).toBe(
      "provider-ade-textiles"
    );
    expect(run.recommendation.selected?.quote.total).toBe(63000);
    expect(run.recommendation.selected?.quote.quantity).toBe(20);
    expect(run.recommendation.selected?.quote.unit).toBe("yards");
    expect(
      run.recommendation.alternatives.map((candidate) => candidate.provider.id)
    ).toEqual(["provider-tola-fabrics"]);

    expect(run.recommendation.exclusions).toContainEqual(
      expect.objectContaining({
        providerId: "provider-bola-textiles",
        reasons: expect.arrayContaining([
          expect.objectContaining({ code: "DEADLINE_MISMATCH" })
        ])
      })
    );
    expect(run.recommendation.exclusions).toContainEqual(
      expect.objectContaining({
        providerId: "provider-sade-fabrics",
        reasons: expect.arrayContaining([
          expect.objectContaining({ code: "OVER_BUDGET" })
        ])
      })
    );

    expect(run.recommendation.approvalRequired).toBe(true);
  });

  it("accepts transcript from both Vapi locations Lara supports", () => {
    const payloads = buildCanonicalAnkaraVapiKrosFixturePayloads(mission.id);
    const ade = projectVerifiedVapiKrosFixture(payloads[0]);
    const tola = projectVerifiedVapiKrosFixture(payloads[1]);

    expect(ade.transcript).toContain("₦60,000");
    expect(tola.transcript).toContain("64k");
  });
});
