import type { CommunicationResult, Quote } from "../schemas";
import {
  normalizeCommunicationTranscript,
  type CommunicationTranscriptNormalizationResult
} from "../intelligence/transcript-normalizer";
import {
  extractQuoteFromCommunication,
  type QuoteExtractionResult
} from "../intelligence/quote-extraction";
import {
  recommend,
  type RecommendationResult
} from "../intelligence/recommendation";
import {
  getMissionSnapshot,
  saveMissionSnapshot
} from "../integrations/neon/mission-snapshot-repository";
import { buildIntegratedMissionSnapshot } from "./integration-snapshot";
import type {
  MissionRecommendation,
  MissionSnapshot
} from "./snapshot";

export type MissionSnapshotStore = {
  get(missionId: string): Promise<MissionSnapshot | null>;
  save(snapshot: MissionSnapshot): Promise<MissionSnapshot>;
};

export type PersistCommunicationIntelligenceInput = {
  communication: CommunicationResult;
  transcript?: string;
  store?: MissionSnapshotStore;
};

export type PersistCommunicationIntelligenceResult = {
  snapshot: MissionSnapshot;
  normalizedCommunication: CommunicationResult;
  normalization?: CommunicationTranscriptNormalizationResult;
  extraction: QuoteExtractionResult;
  recommendation: RecommendationResult;
};

const defaultStore: MissionSnapshotStore = {
  get: getMissionSnapshot,
  save: saveMissionSnapshot
};

function replaceById<T extends { id: string }>(items: T[], next: T): T[] {
  const existing = items.findIndex((item) => item.id === next.id);
  if (existing === -1) return [...items, next];
  return items.map((item, index) => (index === existing ? next : item));
}

function missionRecommendationFrom(
  recommendation: RecommendationResult
): MissionRecommendation | undefined {
  if (recommendation.decisionStatus !== "READY" || !recommendation.selected) {
    return undefined;
  }

  const reasons =
    recommendation.recommendationFactors.length > 0
      ? recommendation.recommendationFactors
      : [recommendation.explanation];

  return {
    providerId: recommendation.selected.provider.id,
    quoteId: recommendation.selected.quote.id,
    reasons
  };
}

/**
 * Atomically persists the intelligence consequence of one already-verified
 * provider communication into Xpen's Mission snapshot.
 *
 * This function does not authenticate webhooks, initiate contact, advance the
 * Mission state, request approval, or execute a transaction. It only:
 * 1. loads the existing Mission snapshot,
 * 2. applies transcript normalization when evidence is present,
 * 3. extracts a canonical Quote when the represented facts permit one,
 * 4. recomputes the deterministic recommendation across all stored Quotes,
 * 5. writes communication + Quote(s) + READY recommendation in one snapshot.
 *
 * BLOCKED_UNKNOWN and NO_VALID_OPTIONS deliberately persist with no selected
 * MissionRecommendation. The underlying communications and Quotes remain in
 * the snapshot so Mission Control can continue gathering evidence.
 */
export async function persistCommunicationIntelligence({
  communication,
  transcript,
  store = defaultStore
}: PersistCommunicationIntelligenceInput): Promise<PersistCommunicationIntelligenceResult> {
  const snapshot = await store.get(communication.missionId);

  if (!snapshot) {
    throw new Error("MISSION_NOT_FOUND");
  }

  if (
    !snapshot.providers.some(
      (provider) => provider.id === communication.providerId
    )
  ) {
    throw new Error("COMMUNICATION_PROVIDER_MISMATCH");
  }

  const normalization = transcript?.trim()
    ? normalizeCommunicationTranscript(communication, transcript, {
        mission: snapshot.mission
      })
    : undefined;
  const normalizedCommunication =
    normalization?.communication ?? communication;

  const extraction = extractQuoteFromCommunication(normalizedCommunication, {
    mission: snapshot.mission,
    quoteId: `quote-${normalizedCommunication.id}`,
    createdAt: normalizedCommunication.occurredAt
  });

  const communications = replaceById(
    snapshot.communications,
    normalizedCommunication
  );
  const quotes: Quote[] = extraction.quote
    ? replaceById(snapshot.quotes, extraction.quote)
    : snapshot.quotes;
  const recommendation = recommend(
    snapshot.mission,
    snapshot.providers,
    quotes
  );

  const updated = buildIntegratedMissionSnapshot({
    mission: snapshot.mission,
    steps: snapshot.steps,
    providers: snapshot.providers,
    communications,
    quotes,
    recommendation: missionRecommendationFrom(recommendation)
  });

  return {
    snapshot: await store.save(updated),
    normalizedCommunication,
    normalization,
    extraction,
    recommendation
  };
}
