import { authorizeOperatorRequest } from "../../../../../lib/operator/operator-auth";
import { getMissionSnapshot } from "../../../../../lib/integrations/neon/mission-snapshot-repository";
import { advanceMissionOrchestration } from "../../../../../lib/mission/orchestrator";

const SAFE_RECOVERY_STAGES = new Set(["COLLECTING_QUOTES", "COMPARING"]);

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  const authFailure = authorizeOperatorRequest(request);
  if (authFailure) return authFailure;

  try {
    const snapshot = await getMissionSnapshot(params.id);

    if (!snapshot) {
      return Response.json({ error: "MISSION_NOT_FOUND" }, { status: 404 });
    }

    if (snapshot.demoMode) {
      return Response.json(
        {
          error: "USE_SIMULATION_CONTROLS",
          message: "Simulation missions should use the demo controls instead."
        },
        { status: 409 }
      );
    }

    if (!SAFE_RECOVERY_STAGES.has(snapshot.mission.status)) {
      return Response.json(
        {
          error: "MISSION_NOT_READY_FOR_SAFE_CONTINUE",
          missionStatus: snapshot.mission.status,
          message:
            "Operator continuation is limited to already-contacted missions. It cannot initiate provider contact."
        },
        { status: 409 }
      );
    }

    const result = await advanceMissionOrchestration(params.id, {
      mode: "LIVE"
    });

    return Response.json({
      ...result,
      externalActionAttempted: false,
      transactionPerformed: false,
      recoveryMode: "SETTLED_EVIDENCE_ONLY"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "RECOVERY_CONTINUE_FAILED";

    if (message === "MISSION_NOT_FOUND") {
      return Response.json({ error: message }, { status: 404 });
    }

    console.error("Safe mission continuation failed", error);
    return Response.json(
      {
        error: "RECOVERY_CONTINUE_FAILED",
        message:
          "SABI stopped safely. No provider was contacted and no transaction was performed."
      },
      { status: 500 }
    );
  }
}
