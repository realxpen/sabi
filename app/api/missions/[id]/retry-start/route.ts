import { waitUntil } from "@vercel/functions";
import {
  getMissionSnapshot,
  saveMissionSnapshot
} from "../../../../../lib/integrations/neon/mission-snapshot-repository";
import {
  buildBimpeHandoffStep,
  dispatchBimpeMissionStart
} from "../../../../../lib/mission/bimpe-handoff";
import { advanceMissionOrchestration } from "../../../../../lib/mission/orchestrator";
import { BIMPE_HANDOFF_STEP } from "../../../../../lib/mission/startup-status";
import type { MissionSnapshot } from "../../../../../lib/mission/snapshot";

export const runtime = "nodejs";

async function bootstrap(snapshot: MissionSnapshot): Promise<MissionSnapshot> {
  let current = snapshot;

  for (let index = 0; index < 6; index += 1) {
    if (current.mission.status === "CONTACTING") return current;

    if (
      !["CREATED", "UNDERSTANDING", "PLANNING", "SEARCHING"].includes(
        current.mission.status
      )
    ) {
      return current;
    }

    const result = await advanceMissionOrchestration(current.mission.id, {
      mode: "LIVE"
    });
    current = result.snapshot;

    if (result.outcome !== "ADVANCED" || current.mission.status === "CONTACTING") {
      return current;
    }
  }

  return current;
}

export async function POST(
  _request: Request,
  context: { params: { id: string } }
) {
  try {
    const snapshot = await getMissionSnapshot(context.params.id);

    if (!snapshot) {
      return Response.json({ error: "MISSION_NOT_FOUND" }, { status: 404 });
    }

    if (snapshot.demoMode) {
      return Response.json({ error: "LIVE_RETRY_NOT_ALLOWED_FOR_SIMULATION" }, { status: 409 });
    }

    if (
      !["CREATED", "UNDERSTANDING", "PLANNING", "SEARCHING", "CONTACTING"].includes(
        snapshot.mission.status
      )
    ) {
      return Response.json(
        {
          error: "MISSION_ALREADY_PROGRESSING",
          missionStatus: snapshot.mission.status
        },
        { status: 409 }
      );
    }

    let current = await bootstrap(snapshot);
    const existingHandoff = current.steps.find(
      (step) => step.type === BIMPE_HANDOFF_STEP
    );

    if (existingHandoff) {
      current = await saveMissionSnapshot({
        ...current,
        steps: current.steps.map((step) =>
          step.id === existingHandoff.id
            ? {
                ...step,
                status: "RUNNING" as const,
                message: "Reconnecting this saved mission to SABI’s live agent."
              }
            : step
        )
      });
    } else {
      current = await saveMissionSnapshot({
        ...current,
        steps: [...current.steps, buildBimpeHandoffStep(current.mission.id)]
      });
    }

    waitUntil(
      dispatchBimpeMissionStart(current).catch((error) => {
        console.error(
          `Bimpe retry handoff status could not be saved for ${current.mission.id}`,
          error
        );
      })
    );

    return Response.json({
      missionId: current.mission.id,
      missionStatus: current.mission.status,
      providerCount: current.providers.length,
      persisted: true,
      duplicateMissionCreated: false,
      externalActionPerformedByRetry: false
    });
  } catch (error) {
    console.error("Mission startup retry failed", error);
    return Response.json(
      { error: "MISSION_STARTUP_RETRY_UNAVAILABLE" },
      { status: 503 }
    );
  }
}
