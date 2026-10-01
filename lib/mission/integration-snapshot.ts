import type {
  CommunicationResult,
  Mission,
  MissionStep,
  Provider,
  Quote
} from "../schemas";
import type {
  MissionRecommendation,
  MissionSnapshot
} from "./snapshot";

type IntegratedMissionSnapshotInput = {
  mission: Mission;
  steps: MissionStep[];
  providers: Provider[];
  communications: CommunicationResult[];
  quotes: Quote[];
  recommendation?: MissionRecommendation;
};

function assertMissionReferences(
  mission: Mission,
  steps: MissionStep[],
  communications: CommunicationResult[],
  quotes: Quote[]
) {
  if (steps.some((step) => step.missionId !== mission.id)) {
    throw new Error("MISSION_STEP_MISMATCH");
  }

  if (communications.some((result) => result.missionId !== mission.id)) {
    throw new Error("COMMUNICATION_MISSION_MISMATCH");
  }

  if (quotes.some((quote) => quote.missionId !== mission.id)) {
    throw new Error("QUOTE_MISSION_MISMATCH");
  }
}

function assertProviderReferences(
  providers: Provider[],
  communications: CommunicationResult[],
  quotes: Quote[]
) {
  const providerIds = new Set(providers.map((provider) => provider.id));

  if (communications.some((result) => !providerIds.has(result.providerId))) {
    throw new Error("COMMUNICATION_PROVIDER_MISMATCH");
  }

  if (quotes.some((quote) => !providerIds.has(quote.providerId))) {
    throw new Error("QUOTE_PROVIDER_MISMATCH");
  }
}

function assertRecommendationReferences(
  recommendation: MissionRecommendation | undefined,
  providers: Provider[],
  quotes: Quote[]
) {
  if (!recommendation) return;

  const provider = providers.find(
    (candidate) => candidate.id === recommendation.providerId
  );
  const quote = quotes.find(
    (candidate) => candidate.id === recommendation.quoteId
  );

  if (!provider || !quote || quote.providerId !== provider.id) {
    throw new Error("RECOMMENDATION_REFERENCE_MISMATCH");
  }
}

export function buildIntegratedMissionSnapshot({
  mission,
  steps,
  providers,
  communications,
  quotes,
  recommendation
}: IntegratedMissionSnapshotInput): MissionSnapshot {
  assertMissionReferences(mission, steps, communications, quotes);
  assertProviderReferences(providers, communications, quotes);
  assertRecommendationReferences(recommendation, providers, quotes);

  return {
    mission,
    steps,
    providers,
    communications,
    quotes,
    recommendation,
    demoMode: false
  };
}
