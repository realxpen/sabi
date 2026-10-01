import { randomUUID } from "node:crypto";
import {
  getMissionSnapshot,
  saveMissionSnapshot
} from "../../../../../lib/integrations/neon/mission-snapshot-repository";
import {
  canTransition,
  transitionMission
} from "../../../../../lib/mission/state-machine";
import { missionStepSchema } from "../../../../../lib/schemas";

export async function POST(
  _request: Request,
  context: { params: { id: string } }
) {
  try {
    const snapshot = await getMissionSnapshot(context.params.id);

    if (!snapshot) {
      return Response.json({ error: "MISSION_NOT_FOUND" }, { status: 404 });
    }

    if (!canTransition(snapshot.mission.status, "CANCELLED")) {
      return Response.json(
        {
          error: "MISSION_CANNOT_BE_CANCELLED",
          missionStatus: snapshot.mission.status
        },
        { status: 409 }
      );
    }

    const step = missionStepSchema.parse({
      id: `step-${randomUUID()}`,
      missionId: snapshot.mission.id,
      type: "HUMAN_CANCELLED",
      status: "COMPLETED",
      message: "Human cancelled the Mission. No external or financial action was performed.",
      createdAt: new Date().toISOString()
    });

    const updatedSnapshot = {
      ...snapshot,
      mission: transitionMission(snapshot.mission, "CANCELLED"),
      steps: [...snapshot.steps, step]
    };

    await saveMissionSnapshot(updatedSnapshot);

    return Response.json({
      missionStatus: updatedSnapshot.mission.status,
      persisted: true,
      transactionPerformed: false,
      message:
        "Human cancellation was persisted. No purchase, booking, transfer, or payment was performed."
    });
  } catch (error) {
    console.error("Failed to persist mission cancellation", error);

    return Response.json(
      { error: "MISSION_CANCELLATION_UNAVAILABLE" },
      { status: 503 }
    );
  }
}
