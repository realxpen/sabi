import {
  recordProviderResponseForAgent,
  recordProviderResponseToolInputSchema
} from "../integrations/bimpe/tools";
import type { MissionSnapshot } from "./snapshot";
import { advanceMissionOrchestration } from "./orchestrator";

const TERMINAL_COMMUNICATION_STATUSES = new Set([
  "COMPLETED",
  "NO_ANSWER",
  "UNAVAILABLE",
  "FAILED"
]);

function allProviderContactsSettled(snapshot: MissionSnapshot): boolean {
  return (
    snapshot.communications.length > 0 &&
    snapshot.communications.every((communication) =>
      TERMINAL_COMMUNICATION_STATUSES.has(communication.status)
    )
  );
}

function completedEvidencePending(snapshot: MissionSnapshot): boolean {
  return snapshot.communications.some(
    (communication) =>
      communication.status === "COMPLETED" &&
      communication.observation?.available === undefined
  );
}

/**
 * Persist supervised factual evidence for one completed provider communication.
 *
 * When every provider contact has settled and no completed communication is
 * still waiting for factual evidence, SABI may safely continue through
 * deterministic comparison to the human-approval checkpoint. This helper never
 * performs a purchase, booking, payment or other consequential action.
 */
export async function recordSupervisedProviderEvidence(input: unknown) {
  const parsed = recordProviderResponseToolInputSchema.parse(input);
  const recorded = await recordProviderResponseForAgent(parsed);
  let snapshot = recorded.snapshot;

  if (
    snapshot.mission.status === "COLLECTING_QUOTES" &&
    allProviderContactsSettled(snapshot) &&
    !completedEvidencePending(snapshot)
  ) {
    const mode = snapshot.demoMode ? "SIMULATION" : "LIVE";
    const comparisonStage = await advanceMissionOrchestration(
      snapshot.mission.id,
      { mode }
    );
    snapshot = comparisonStage.snapshot;

    if (snapshot.mission.status === "COMPARING") {
      const approvalStage = await advanceMissionOrchestration(
        snapshot.mission.id,
        { mode }
      );
      snapshot = approvalStage.snapshot;
    }
  }

  return {
    quote: recorded.quote,
    snapshot,
    allProviderContactsSettled: allProviderContactsSettled(snapshot),
    completedEvidencePending: completedEvidencePending(snapshot),
    consequentialActionPerformed: false
  };
}
