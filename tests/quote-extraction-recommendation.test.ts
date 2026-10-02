import { describe, expect, it } from "vitest";
import { communicationResultSchema, missionSchema } from "../lib/schemas";
import {
  extractQuotesFromCommunications,
  intelligenceDemoProviders,
  recommend
} from "../lib/intelligence";

function makeMission(quantity?: number) {
  return missionSchema.parse({
    id: quantity === undefined ? "mission-live-quotes" : "mission-live-quotes-quantity",
    type: "PROCUREMENT",
    status: "COLLECTING_QUOTES",
    rawRequest:
      quantity === undefined
        ? "I need black Ankara delivered to Yaba tomorrow. My budget is ₦70,000."
        : "I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.",
    item: "black Ankara",
    quantity,
    unit: quantity === undefined ? undefined : "yards",
    budget: 70000,
    location: "Yaba",
    deadline: "tomorrow",
    approvalRequired: true,
    createdAt: "2026-10-01T18:00:00.000Z"
  });
}

function completedCall(
  missionId: string,
  providerId: string,
  id: string,
  price: number,
  deliveryFee: number
) {
  return communicationResultSchema.parse({
    id,
    missionId,
    providerId,
    channel: "CALL",
    status: "COMPLETED",
    observation: {
      available: true,
      price,
      deliveryFee,
      deliveryDate: "tomorrow"
    },
    occurredAt: "2026-10-01T18:30:00.000Z"
  });
}

describe("communication evidence → Quote → recommendation", () => {
  it("produces a READY recommendation when extracted facts satisfy all represented hard constraints", () => {
    const mission = makeMission();
    const communications = [
      completedCall(
        mission.id,
        "provider-ade-textiles",
        "live-ade",
        60000,
        3000
      ),
      completedCall(
        mission.id,
        "provider-tola-fabrics",
        "live-tola",
        64000,
        3000
      )
    ];

    const extracted = extractQuotesFromCommunications(communications, {
      mission,
      createdAt: "2026-10-01T18:31:00.000Z"
    });
    const result = recommend(
      mission,
      intelligenceDemoProviders,
      extracted.quotes
    );

    expect(extracted.quotes).toHaveLength(2);
    expect(extracted.followUps).toEqual([]);
    expect(result.decisionStatus).toBe("READY");
    expect(result.selected?.provider.id).toBe("provider-ade-textiles");
    expect(result.selected?.quote.total).toBe(63000);
    expect(result.selected?.quote.sourceReference).toBe(
      "communication:live-ade"
    );
  });

  it("keeps the canonical 20-yard Mission BLOCKED_UNKNOWN even after otherwise complete call evidence", () => {
    const mission = makeMission(20);
    const communications = [
      completedCall(
        mission.id,
        "provider-ade-textiles",
        "live-ade-quantity",
        60000,
        3000
      )
    ];

    const extracted = extractQuotesFromCommunications(communications, {
      mission,
      createdAt: "2026-10-01T18:31:00.000Z"
    });
    const result = recommend(
      mission,
      intelligenceDemoProviders,
      extracted.quotes
    );

    expect(extracted.quotes).toHaveLength(1);
    expect(extracted.followUps[0]?.missingFacts.map((item) => item.code)).toContain(
      "QUANTITY_CAPACITY_UNREPRESENTED"
    );
    expect(result.decisionStatus).toBe("BLOCKED_UNKNOWN");
    expect(result.selected).toBeUndefined();
  });
});
