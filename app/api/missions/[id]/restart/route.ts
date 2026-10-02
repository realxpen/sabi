import {
  getMissionSnapshot,
  saveMissionSnapshot
} from "../../../../../lib/integrations/neon/mission-snapshot-repository";
import { buildInitialMissionSnapshot } from "../../../../../lib/mission/initial-snapshot";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  try {
    const snapshot = await getMissionSnapshot(params.id);

    if (!snapshot) {
      return Response.json({ error: "MISSION_NOT_FOUND" }, { status: 404 });
    }

    if (!snapshot.demoMode) {
      return Response.json(
        {
          error: "LIVE_MISSION_RESTART_NOT_ALLOWED",
          message:
            "Only clearly labelled simulation missions can be restarted from Mission Control."
        },
        { status: 409 }
      );
    }

    const restarted = buildInitialMissionSnapshot(
      snapshot.mission.rawRequest,
      snapshot.mission.id,
      true
    );
    const persisted = await saveMissionSnapshot(restarted);

    return Response.json({
      missionId: persisted.mission.id,
      missionStatus: persisted.mission.status,
      restarted: true,
      simulation: true,
      externalActionAttempted: false,
      transactionPerformed: false
    });
  } catch (error) {
    console.error("Failed to restart simulation mission", error);
    return Response.json(
      {
        error: "MISSION_RESTART_UNAVAILABLE",
        message:
          "SABI could not restart the simulation. No provider contact or transaction was attempted."
      },
      { status: 503 }
    );
  }
}
