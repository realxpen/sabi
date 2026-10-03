import { startBimpeMissionOrchestration } from "../integrations/bimpe/conversation-orchestrator";
import { updateMissionStep } from "../integrations/neon/mission-snapshot-repository";
import type { MissionStep } from "../schemas";
import type { MissionSnapshot } from "./snapshot";
import { BIMPE_HANDOFF_STEP } from "./startup-status";

export function buildBimpeHandoffStep(missionId: string): MissionStep {
  return {
    id: `${missionId}-bimpe-handoff`, missionId,
    type: BIMPE_HANDOFF_STEP, status: "RUNNING",
    message: "Connecting the saved mission to SABI’s live agent.",
    createdAt: new Date().toISOString()
  };
}

export async function dispatchBimpeMissionStart(snapshot: MissionSnapshot): Promise<void> {
  const missionId = snapshot.mission.id;
  const step = snapshot.steps.find((candidate) => candidate.type === BIMPE_HANDOFF_STEP);
  if (!step) throw new Error("BIMPE_HANDOFF_STEP_REQUIRED");

  console.info("SABI live agent handoff started", { missionId });
  let resultStep: MissionStep;
  try {
    await startBimpeMissionOrchestration({ missionId, request: snapshot.mission.rawRequest });
    resultStep = {
      ...step, status: "COMPLETED",
      message: "Live agent accepted the mission message. Waiting for persisted workflow progress."
    };
    console.info("SABI live agent handoff accepted", { missionId });
  } catch (error) {
    console.error("SABI live agent handoff failed", {
      missionId, error: error instanceof Error ? error.message : "Unknown handoff error"
    });
    resultStep = {
      ...step, status: "FAILED",
      message: "SABI could not confirm its live agent connection. Check the connection before retrying."
    };
  }

  // Update only this step: Bimpe tools may already have advanced the mission.
  await updateMissionStep(resultStep);
}
