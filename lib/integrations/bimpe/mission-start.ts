import { randomUUID } from "node:crypto";
import { z } from "zod";
import { saveMissionSnapshot } from "../neon/mission-snapshot-repository";
import { buildInitialMissionSnapshot } from "../../mission/initial-snapshot";
import {
  advanceMissionOrchestration,
  type MissionOrchestrationOutcome
} from "../../mission/orchestrator";

export const startMissionToolInputSchema = z.object({
  request: z.string().trim().min(1)
});

/**
 * Create the durable live Mission used by Bimpe for one sourcing request.
 *
 * This intentionally stops at CONTACTING. It may attach configured provider
 * metadata, but it never initiates a call, creates a Quote, requests approval,
 * or performs a transaction. The returned missionId is the correlation key
 * Bimpe must reuse for every stateful action in this sourcing mission.
 */
export async function startMissionForAgent(
  input: z.infer<typeof startMissionToolInputSchema>
) {
  const { request } = startMissionToolInputSchema.parse(input);
  const missionId = `mission-bimpe-${randomUUID()}`;

  let snapshot = await saveMissionSnapshot(
    buildInitialMissionSnapshot(request, missionId, false)
  );
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
