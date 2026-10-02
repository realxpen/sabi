import { quoteSchema, type CommunicationResult, type Quote, type QuoteSource } from "../schemas";

function quoteSourceForCommunication(communication: CommunicationResult): QuoteSource {
  switch (communication.channel) {
    case "CALL":
      return "CALL";
    case "SMS":
      return "SMS";
    case "MOCK":
      return "OTHER";
    case "OTHER":
      return "OTHER";
  }
}

/**
 * Convert explicit structured provider observations into a canonical Quote.
 *
 * Truth boundary:
 * - communication must be COMPLETED
 * - observation must explicitly include availability
 * - no transcript/summary text is parsed here
 * - provider-confirmed quantity/unit are preserved when represented
 * - explicit total is preserved; otherwise total is derived only when both
 *   price and delivery fee are explicit
 * - missing values remain missing
 */
export function quoteFromCommunicationEvidence(
  communication: CommunicationResult
): Quote | undefined {
  if (communication.status !== "COMPLETED") return undefined;

  const observation = communication.observation;
  if (!observation || observation.available === undefined) return undefined;

  const total =
    observation.total ??
    (observation.price !== undefined && observation.deliveryFee !== undefined
      ? observation.price + observation.deliveryFee
      : undefined);

  return quoteSchema.parse({
    id: `quote-${communication.id}`,
    missionId: communication.missionId,
    providerId: communication.providerId,
    available: observation.available,
    quantity: observation.available ? observation.quantity : undefined,
    unit: observation.available ? observation.unit : undefined,
    price: observation.price,
    deliveryFee: observation.deliveryFee,
    total,
    deliveryDate: observation.deliveryDate,
    notes: observation.notes,
    source: quoteSourceForCommunication(communication),
    sourceReference: communication.externalId ?? communication.id,
    createdAt: communication.occurredAt
  });
}
