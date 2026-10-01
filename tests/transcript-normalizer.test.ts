import { describe, expect, it } from "vitest";
import {
  communicationResultSchema,
  missionSchema,
  type CommunicationResult
} from "../lib/schemas";
import {
  extractQuoteFromCommunication,
  normalizeCommunicationTranscript,
  normalizeProviderTranscript,
  parseRoleLabeledTranscript,
  type TranscriptTurn
} from "../lib/intelligence";

const mission = missionSchema.parse({
  id: "mission-transcript-normalizer",
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
  createdAt: "2026-10-01T20:00:00.000Z"
});

function completedCommunication(
  input: Partial<CommunicationResult> = {}
): CommunicationResult {
  return communicationResultSchema.parse({
    id: "communication-transcript",
    missionId: mission.id,
    providerId: "provider-ade-textiles",
    channel: "CALL",
    status: "COMPLETED",
    externalId: "vapi-call-123",
    occurredAt: "2026-10-01T20:05:00.000Z",
    ...input
  });
}

describe("parseRoleLabeledTranscript", () => {
  it("maps Vapi-style AI/User labels to SABI/provider turns", () => {
    const turns = parseRoleLabeledTranscript(
      "AI: Do you have 20 yards of black Ankara?\nUser: Yes, we have it."
    );

    expect(turns).toEqual([
      { speaker: "SABI", text: "Do you have 20 yards of black Ankara?" },
      { speaker: "PROVIDER", text: "Yes, we have it." }
    ]);
  });

  it("keeps an unlabeled transcript unknown instead of guessing the speaker", () => {
    const result = normalizeProviderTranscript(
      "Available for ₦60,000 and delivery is ₦3,000 tomorrow.",
      { mission }
    );

    expect(result.status).toBe("NO_PROVIDER_EVIDENCE");
    expect(result.observation).toBeUndefined();
    expect(result.ambiguities.map((item) => item.code)).toEqual(
      expect.arrayContaining(["UNLABELED_TRANSCRIPT", "UNKNOWN_SPEAKER_CONTENT"])
    );
  });
});

describe("normalizeProviderTranscript", () => {
  it("extracts explicit provider facts while preserving field-level evidence", () => {
    const turns: TranscriptTurn[] = [
      {
        speaker: "SABI",
        text: "Do you have 20 yards of black Ankara available?"
      },
      { speaker: "PROVIDER", text: "Yes, we have it." },
      { speaker: "SABI", text: "How much would the 20 yards cost?" },
      { speaker: "PROVIDER", text: "60000" },
      { speaker: "SABI", text: "Can you deliver to Yaba tomorrow?" },
      { speaker: "PROVIDER", text: "Yes, tomorrow works." },
      { speaker: "SABI", text: "How much is the delivery fee?" },
      { speaker: "PROVIDER", text: "3000" }
    ];

    const result = normalizeProviderTranscript(turns, { mission });

    expect(result.status).toBe("OBSERVATION_CREATED");
    expect(result.observation).toEqual({
      available: true,
      price: 60000,
      deliveryFee: 3000,
      deliveryDate: "tomorrow"
    });
    expect(result.evidence.map((item) => item.field)).toEqual(
      expect.arrayContaining([
        "available",
        "price",
        "deliveryFee",
        "deliveryDate",
        "quantityCapacity"
      ])
    );
    expect(result.unrepresentedQuantityEvidence).toEqual(
      expect.objectContaining({ quantity: 20, unit: "yards" })
    );
  });

  it("extracts explicit unavailability without inventing price or delivery facts", () => {
    const result = normalizeProviderTranscript(
      [
        { speaker: "SABI", text: "Do you have black Ankara available?" },
        { speaker: "PROVIDER", text: "No, we are out of stock." }
      ],
      { mission }
    );

    expect(result.observation).toEqual({
      available: false,
      price: undefined,
      deliveryFee: undefined,
      deliveryDate: undefined
    });
    expect(result.evidence).toContainEqual(
      expect.objectContaining({ field: "available", value: false })
    );
  });

  it("leaves conflicting provider prices unknown instead of choosing one", () => {
    const result = normalizeProviderTranscript(
      [
        { speaker: "SABI", text: "How much is the Ankara?" },
        { speaker: "PROVIDER", text: "60000" },
        { speaker: "SABI", text: "Please confirm the price." },
        { speaker: "PROVIDER", text: "62000" }
      ],
      { mission }
    );

    expect(result.observation?.price).toBeUndefined();
    expect(result.ambiguities).toContainEqual(
      expect.objectContaining({ code: "CONFLICTING_PRICE" })
    );
  });

  it("does not infer a delivery fee from a product price", () => {
    const result = normalizeProviderTranscript(
      [
        { speaker: "SABI", text: "How much would it cost?" },
        { speaker: "PROVIDER", text: "60000" }
      ],
      { mission }
    );

    expect(result.observation?.price).toBe(60000);
    expect(result.observation?.deliveryFee).toBeUndefined();
  });
});

describe("normalizeCommunicationTranscript", () => {
  it("applies normalized observation only to a completed communication", () => {
    const normalized = normalizeCommunicationTranscript(
      completedCommunication(),
      [
        { speaker: "SABI", text: "Do you have black Ankara available?" },
        { speaker: "PROVIDER", text: "Yes, it is available." }
      ],
      { mission }
    );

    expect(normalized.observationApplied).toBe(true);
    expect(normalized.communication.observation?.available).toBe(true);
  });

  it("does not apply transcript facts to NO_ANSWER", () => {
    const communication = completedCommunication({
      status: "NO_ANSWER",
      observation: undefined
    });

    const normalized = normalizeCommunicationTranscript(
      communication,
      [
        { speaker: "SABI", text: "Do you have Ankara available?" },
        { speaker: "PROVIDER", text: "Yes, available." }
      ],
      { mission }
    );

    expect(normalized.observationApplied).toBe(false);
    expect(normalized.communication.observation).toBeUndefined();
    expect(normalized.normalization.ambiguities).toContainEqual(
      expect.objectContaining({ code: "COMMUNICATION_NOT_COMPLETED" })
    );
  });

  it("preserves adapter-supplied structured observation instead of overwriting it", () => {
    const communication = completedCommunication({
      observation: { available: false }
    });

    const normalized = normalizeCommunicationTranscript(
      communication,
      [
        { speaker: "SABI", text: "Do you have Ankara available?" },
        { speaker: "PROVIDER", text: "Yes, available." }
      ],
      { mission }
    );

    expect(normalized.observationApplied).toBe(false);
    expect(normalized.communication.observation).toEqual({ available: false });
    expect(normalized.normalization.ambiguities).toContainEqual(
      expect.objectContaining({ code: "EXISTING_OBSERVATION_PRESERVED" })
    );
  });

  it("feeds normalized provider evidence into the existing safe Quote extractor", () => {
    const normalized = normalizeCommunicationTranscript(
      completedCommunication(),
      [
        {
          speaker: "SABI",
          text: "Do you have 20 yards of black Ankara available?"
        },
        { speaker: "PROVIDER", text: "Yes, we have it." },
        { speaker: "SABI", text: "How much would the 20 yards cost?" },
        { speaker: "PROVIDER", text: "60000" },
        { speaker: "SABI", text: "Can you deliver to Yaba tomorrow?" },
        { speaker: "PROVIDER", text: "Yes." },
        { speaker: "SABI", text: "How much is delivery?" },
        { speaker: "PROVIDER", text: "3000" }
      ],
      { mission }
    );

    const quoteResult = extractQuoteFromCommunication(normalized.communication, {
      mission,
      quoteId: "quote-transcript-normalized",
      createdAt: "2026-10-01T20:06:00.000Z"
    });

    expect(quoteResult.status).toBe("QUOTE_CREATED");
    expect(quoteResult.quote).toEqual(
      expect.objectContaining({
        available: true,
        price: 60000,
        deliveryFee: 3000,
        total: 63000,
        deliveryDate: "tomorrow",
        sourceReference: "communication:communication-transcript"
      })
    );
    expect(quoteResult.missingFacts).toContainEqual(
      expect.objectContaining({ code: "QUANTITY_CAPACITY_UNREPRESENTED" })
    );
  });
});
