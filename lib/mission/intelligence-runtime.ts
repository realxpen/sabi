import { recommend, type RecommendationResult } from "../intelligence";
import { getMissionSnapshot } from "../integrations/neon/mission-snapshot-repository";
import type { MissionSnapshot } from "./snapshot";
import { recordIntelligenceInMission } from "./persisted-integration";

export type MissionIntelligenceRun = {
  snapshot: MissionSnapshot;
  intelligence: RecommendationResult;
};

/**
 * Run Femi's deterministic intelligence over the currently persisted provider
 * and Quote set, then persist only the validated recommendation back into
 * Mission Control. This never invents missing Quote fields and never bypasses
 * the human approval checkpoint.
 */
export async function runMissionIntelligence(
  missionId: string
): Promise<MissionIntelligenceRun> {
  const current = await getMissionSnapshot(missionId);

  if (!current) {
    throw new Error("MISSION_NOT_FOUND");
  }

  const intelligence = recommend(
    current.mission,
    current.providers,
    current.quotes
  );

  const recommendation = intelligence.selected
    ? {
        providerId: intelligence.selected.provider.id,
        quoteId: intelligence.selected.quote.id,
        reasons: [
          intelligence.explanation ??
            "Selected by deterministic hard-constraint filtering and ranking.",
          ...intelligence.recommendationFactors
        ]
      }
    : undefined;

  const snapshot = await recordIntelligenceInMission({
    missionId,
    providers: current.providers,
    quotes: current.quotes,
    recommendation
  });

  return { snapshot, intelligence };
}
