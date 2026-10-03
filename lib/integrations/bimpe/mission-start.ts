import { randomUUID } from "node:crypto";
import { z } from "zod";
import { saveMissionSnapshot } from "../neon/mission-snapshot-repository";
import { discoverRegisteredProvidersForMission } from "../neon/provider-registry";
import { discoverLiveTestProvidersForMission } from "../providers/live-test-directory";
import { buildInitialMissionSnapshot } from "../../mission/initial-snapshot";
import {
  advanceMissionOrchestration,
  type MissionOrchestrationOutcome
} from "../../mission/orchestrator";

export const startMissionToolInputSchema = z.object({
  request: z.string().trim().min(1)
});

function uniqueProviders<T extends { id: string }>(providers: T[]): T[] {
  return [...new Map(providers.map((provider) => [provider.id, provider])).values()];
}

/**
 * Create the durable live Mission used by Bimpe for one sourcing request.
 *
 * This intentionally stops at CONTACTING. It may attach consented configured or
 * persisted provider metadata, but it never initiates a call, creates a Quote,
 * requests approval, or performs a transaction. The returned missionId is the
 * correlation key Bimpe must reuse for every stateful action in this mission.
 */
export async function startMissionForAgent(
  input: z.infer<typeof startMissionToolInputSchema>
) {
  const { request } = startMissionToolInputSchema.parse(input);
  const missionId = `mission-bimpe-${randomUUID()}`;
  const initial = buildInitialMissionSnapshot(request, missionId, false);
  const configuredProviders =
    discoverLiveTestProvidersForMission(initial.mission) ?? [];
  const registeredProviders = await discoverRegisteredProvidersForMission(
    initial.mission
  );

  let snapshot = await saveMissionSnapshot({
    ...initial,
    providers: uniqueProviders([
      ...configuredProviders,
      ...registeredProviders
    ])
  });
  let outcome: MissionOrchestrationOutcome = "ADVANCED";
  let reason = "Live mission persisted.";

  // CREATED -> UNDERSTANDING -> PLANNING -> SEARCHING -> CONTACTING.
  // Do not advance CONTACTING itself because that stage initiates provider contact.
  for (let step = 0; step < 4 && snapshot.mission.status !== "CONTACTING"; step += 1) {
    const result = await advanceMissionOrchestration(snapshot.mission.id, {
      mode: "LIVE"
    });

    snapshot = result.snapshot;
    outcome = result.outcome;
    reason = result.reason;

    if (result.outcome === "WAITING" || result.outcome === "CHECKPOINT") {
      break;
    }
  }

  return {
    snapshot,
    readyForProviderCall:
      snapshot.mission.status === "CONTACTING" && snapshot.providers.length > 0,
    outcome,
    reason
  };
}
