import {
  quoteSchema,
  type CommunicationResult,
  type Mission,
  type Quote
} from "../schemas";

export type QuoteEvidenceGapCode =
  | "MISSION_MISMATCH"
  | "COMMUNICATION_NOT_COMPLETED"
  | "OBSERVATION_MISSING"
  | "AVAILABILITY_UNKNOWN"
  | "PRICE_UNKNOWN"
  | "DELIVERY_FEE_UNKNOWN"
  | "TOTAL_UNKNOWN"
  | "DELIVERY_DATE_UNKNOWN"
  | "QUANTITY_CAPACITY_UNREPRESENTED";

export type QuoteEvidenceGap = {
  code: QuoteEvidenceGapCode;
  message: string;
  blocksQuoteCreation: boolean;
};

export type QuoteObservedFactCode =
  | "AVAILABILITY"
  | "PRICE"
  | "DELIVERY_FEE"
  | "TOTAL"
  | "DELIVERY_DATE"
  | "NOTES";

export type QuoteObservedFact = {
  code: QuoteObservedFactCode;
  value: string | number | boolean;
  derived?: boolean;
};

export type QuoteExtractionStatus =
  | "QUOTE_CREATED"
  | "INCOMPLETE"
  | "NOT_QUOTABLE";

export type QuoteExtractionResult = {
  status: QuoteExtractionStatus;
  quote?: Quote;
  observedFacts: QuoteObservedFact[];
  missingFacts: QuoteEvidenceGap[];
  needsFollowUp: boolean;
  provenance: {
    communicationId: string;
    missionId: string;
    providerId: string;
    channel: CommunicationResult["channel"];
    communicationStatus: CommunicationResult["status"];
    externalId?: string;
    occurredAt: string;
  };
};

export type QuoteExtractionOptions = {
  mission?: Mission;
  quoteId?: string;
  createdAt?: string;
};

function quoteSourceFromChannel(
  channel: CommunicationResult["channel"]
): Quote["source"] {
  if (channel === "CALL") return "CALL";
  if (channel === "SMS") return "SMS";
  return "OTHER";
}

function gap(
  code: QuoteEvidenceGapCode,
  message: string,
  blocksQuoteCreation: boolean
): QuoteEvidenceGap {
  return { code, message, blocksQuoteCreation };
}

function provenance(
  communication: CommunicationResult
): QuoteExtractionResult["provenance"] {
  return {
    communicationId: communication.id,
    missionId: communication.missionId,
    providerId: communication.providerId,
    channel: communication.channel,
    communicationStatus: communication.status,
    externalId: communication.externalId,
    occurredAt: communication.occurredAt
  };
}

/**
 * Converts a normalized CommunicationResult observation into canonical Quote
 * data without guessing missing provider facts.
 *
 * Minimum evidence required to create a Quote is an explicit completed
 * communication plus observation.available. Other absent facts remain absent
 * on Quote and are returned as explicit follow-up gaps.
 */
export function extractQuoteFromCommunication(
  communication: CommunicationResult,
  options: QuoteExtractionOptions = {}
): QuoteExtractionResult {
  const observedFacts: QuoteObservedFact[] = [];
  const missingFacts: QuoteEvidenceGap[] = [];
  const sourceProvenance = provenance(communication);

  if (
    options.mission !== undefined &&
    options.mission.id !== communication.missionId
  ) {
    missingFacts.push(
      gap(
        "MISSION_MISMATCH",
        `Communication mission ${communication.missionId} does not match Mission ${options.mission.id}.`,
        true
      )
    );

    return {
      status: "NOT_QUOTABLE",
      observedFacts,
      missingFacts,
      needsFollowUp: true,
      provenance: sourceProvenance
    };
  }

  if (communication.status !== "COMPLETED") {
    missingFacts.push(
      gap(
        "COMMUNICATION_NOT_COMPLETED",
        `Communication status ${communication.status} is not a completed provider response.`,
        true
      )
    );

    return {
      status: "NOT_QUOTABLE",
      observedFacts,
      missingFacts,
      needsFollowUp: communication.status !== "NO_ANSWER",
      provenance: sourceProvenance
    };
  }

  const observation = communication.observation;
  if (observation === undefined) {
    missingFacts.push(
      gap(
        "OBSERVATION_MISSING",
        "Completed communication has no structured provider observation.",
        true
      ),
      gap(
        "AVAILABILITY_UNKNOWN",
        "Provider availability is not represented, so canonical Quote.available cannot be set safely.",
        true
      )
    );

    return {
      status: "INCOMPLETE",
      observedFacts,
      missingFacts,
      needsFollowUp: true,
      provenance: sourceProvenance
    };
  }

  if (observation.available === undefined) {
    if (observation.price !== undefined) {
      observedFacts.push({ code: "PRICE", value: observation.price });
    }
    if (observation.deliveryFee !== undefined) {
      observedFacts.push({
        code: "DELIVERY_FEE",
        value: observation.deliveryFee
      });
    }
    if (observation.deliveryDate !== undefined) {
      observedFacts.push({
        code: "DELIVERY_DATE",
        value: observation.deliveryDate
      });
    }
    if (observation.notes !== undefined) {
      observedFacts.push({ code: "NOTES", value: observation.notes });
    }

    missingFacts.push(
      gap(
        "AVAILABILITY_UNKNOWN",
        "Provider availability is not represented, so canonical Quote.available cannot be set safely.",
        true
      )
    );

    return {
      status: "INCOMPLETE",
      observedFacts,
      missingFacts,
      needsFollowUp: true,
      provenance: sourceProvenance
    };
  }

  observedFacts.push({
    code: "AVAILABILITY",
    value: observation.available
  });

  if (observation.price !== undefined) {
    observedFacts.push({ code: "PRICE", value: observation.price });
  }
  if (observation.deliveryFee !== undefined) {
    observedFacts.push({
      code: "DELIVERY_FEE",
      value: observation.deliveryFee
    });
  }
  if (observation.deliveryDate !== undefined) {
    observedFacts.push({
      code: "DELIVERY_DATE",
      value: observation.deliveryDate
    });
  }
  if (observation.notes !== undefined) {
    observedFacts.push({ code: "NOTES", value: observation.notes });
  }

  const total =
    observation.price !== undefined && observation.deliveryFee !== undefined
      ? observation.price + observation.deliveryFee
      : undefined;

  if (total !== undefined) {
    observedFacts.push({
      code: "TOTAL",
      value: total,
      derived: true
    });
  }

  const quote = quoteSchema.parse({
    id: options.quoteId ?? `quote-${communication.id}`,
    missionId: communication.missionId,
    providerId: communication.providerId,
    available: observation.available,
    price: observation.price,
    deliveryFee: observation.deliveryFee,
    total,
    deliveryDate: observation.deliveryDate,
    notes: observation.notes,
    source: quoteSourceFromChannel(communication.channel),
    sourceReference: `communication:${communication.id}`,
    createdAt: options.createdAt ?? new Date().toISOString()
  });

  // An explicit unavailable response is already decision-useful. Do not invent
  // pricing or delivery requirements for an option the provider said is absent.
  if (observation.available) {
    if (observation.price === undefined) {
      missingFacts.push(
        gap(
          "PRICE_UNKNOWN",
          "Provider price is not represented.",
          false
        )
      );
    }

    if (observation.deliveryFee === undefined) {
      missingFacts.push(
        gap(
          "DELIVERY_FEE_UNKNOWN",
          "Delivery fee is not represented; it must not be assumed to be zero.",
          false
        )
      );
    }

    if (total === undefined) {
      missingFacts.push(
        gap(
          "TOTAL_UNKNOWN",
          "Total cannot be derived unless both price and delivery fee are represented.",
          false
        )
      );
    }

    if (
      options.mission?.deadline !== undefined &&
      observation.deliveryDate === undefined
    ) {
      missingFacts.push(
        gap(
          "DELIVERY_DATE_UNKNOWN",
          `Mission deadline ${options.mission.deadline} cannot be checked because delivery date is not represented.`,
          false
        )
      );
    }

    if (options.mission?.quantity !== undefined) {
      const unit = options.mission.unit ? ` ${options.mission.unit}` : "";
      missingFacts.push(
        gap(
          "QUANTITY_CAPACITY_UNREPRESENTED",
          `The current shared CommunicationResult/Quote contracts cannot represent factual confirmation of ${options.mission.quantity}${unit} capacity.`,
          false
        )
      );
    }
  }

  return {
    status: "QUOTE_CREATED",
    quote,
    observedFacts,
    missingFacts,
    needsFollowUp: missingFacts.length > 0,
    provenance: sourceProvenance
  };
}

export function extractQuotesFromCommunications(
  communications: CommunicationResult[],
  options: Omit<QuoteExtractionOptions, "quoteId"> = {}
): {
  results: QuoteExtractionResult[];
  quotes: Quote[];
  followUps: QuoteExtractionResult[];
} {
  const results = communications.map((communication) =>
    extractQuoteFromCommunication(communication, {
      ...options,
      quoteId: `quote-${communication.id}`
    })
  );

  return {
    results,
    quotes: results.flatMap((result) =>
      result.quote === undefined ? [] : [result.quote]
    ),
    followUps: results.filter(
      (result) => result.status !== "QUOTE_CREATED" || result.needsFollowUp
    )
  };
}
