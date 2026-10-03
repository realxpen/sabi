import { createConfiguredCommunicationAdapter } from "../integrations/communication/live-runtime";
import { getCommunicationEvidenceForAgent } from "../integrations/bimpe/communication-evidence";
import { refreshCommunicationForAgent } from "../integrations/bimpe/communication-runtime";
import { recordProviderResponseForAgent } from "../integrations/bimpe/tools";
import { getMissionSnapshot } from "../integrations/neon/mission-snapshot-repository";
import { advanceMissionOrchestration } from "./orchestrator";
import { extractProviderFactsFromTranscript } from "./transcript-facts";

const STOP = new Set([
  "AWAITING_APPROVAL",
  "APPROVED",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "ESCALATED"
]);

export type LiveMissionReconcileResult = {
  status: string;
  reason: string;
  progressed: boolean;
};

export async function reconcileLiveMission(
  missionId: string,
  maxIterations = 8
): Promise<LiveMissionReconcileResult> {
  let progressed = false;
  let reason = "NO_CHANGE";

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let snapshot = await getMissionSnapshot(missionId);
    if (!snapshot) throw new Error("MISSION_NOT_FOUND");

    if (STOP.has(snapshot.mission.status)) {
      return { status: snapshot.mission.status, reason: "HUMAN_OR_TERMINAL_CHECKPOINT", progressed };
    }

    if (snapshot.mission.status === "COLLECTING_QUOTES") {
      const active = snapshot.communications.filter((communication) =>
        ["INITIATED", "IN_PROGRESS"].includes(communication.status)
      );

      for (const communication of active) {
        try {
          await refreshCommunicationForAgent({
            missionId,
            communicationId: communication.id
          });
          progressed = true;
        } catch (error) {
          console.warn("SABI live reconcile could not refresh communication", {
            missionId,
            communicationId: communication.id,
            error
          });
        }
      }

      snapshot = await getMissionSnapshot(missionId);
      if (!snapshot) throw new Error("MISSION_NOT_FOUND");

      const completedWithoutQuote = snapshot.communications.filter((communication) => {
        if (communication.status !== "COMPLETED" || communication.channel !== "CALL") return false;
        const sourceReference = communication.externalId ?? communication.id;
        return !snapshot!.quotes.some(
          (quote) =>
            quote.providerId === communication.providerId &&
            quote.sourceReference === sourceReference
        );
      });

      for (const communication of completedWithoutQuote) {
        try {
          const evidence = await getCommunicationEvidenceForAgent({
            missionId,
            communicationId: communication.id
          });
          const facts = extractProviderFactsFromTranscript(snapshot.mission, evidence.transcript);

          if (facts.available === undefined) {
            reason = "COMPLETED_CALL_NEEDS_FACT_CLARIFICATION";
            continue;
          }

          await recordProviderResponseForAgent({
            missionId,
            communicationId: communication.id,
            available: facts.available,
            quantity: facts.quantity,
            unit: facts.unit,
            price: facts.price,
            deliveryFee: facts.deliveryFee,
            total: facts.total,
            deliveryDate: facts.deliveryDate,
            notes: facts.notes
          });
          progressed = true;
        } catch (error) {
          console.warn("SABI live reconcile is waiting for call evidence", {
            missionId,
            communicationId: communication.id,
            error
          });
          reason = "WAITING_FOR_CALL_EVIDENCE";
        }
      }
    }

    snapshot = await getMissionSnapshot(missionId);
    if (!snapshot) throw new Error("MISSION_NOT_FOUND");
    if (STOP.has(snapshot.mission.status)) {
      return { status: snapshot.mission.status, reason: "HUMAN_OR_TERMINAL_CHECKPOINT", progressed };
    }

    const before = snapshot.mission.status;
    const orchestration = await advanceMissionOrchestration(missionId, {
      mode: "LIVE",
      communicationAdapter: createConfiguredCommunicationAdapter()
    });
    reason = orchestration.reason;

    if (orchestration.snapshot.mission.status !== before || orchestration.outcome === "ADVANCED") {
      progressed = true;
      continue;
    }

    return {
      status: orchestration.snapshot.mission.status,
      reason,
      progressed
    };
  }

  const finalSnapshot = await getMissionSnapshot(missionId);
  if (!finalSnapshot) throw new Error("MISSION_NOT_FOUND");
  return {
    status: finalSnapshot.mission.status,
    reason: "RECONCILE_ITERATION_LIMIT",
    progressed
  };
}
