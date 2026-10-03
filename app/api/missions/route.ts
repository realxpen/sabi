import { waitUntil } from "@vercel/functions";
import { ZodError, z } from "zod";
import {
  isBimpeMissionOrchestrationConfigured,
  missingBimpeMissionConfiguration
} from "../../../lib/integrations/bimpe/conversation-orchestrator";
import { saveMissionSnapshot } from "../../../lib/integrations/neon/mission-snapshot-repository";
import { buildBimpeHandoffStep, dispatchBimpeMissionStart } from "../../../lib/mission/bimpe-handoff";
import {
  createPersistedMission,
  missionExecutionModeSchema,
  readDefaultMissionExecutionMode
} from "../../../lib/mission/create-mission";

const createMissionRequestSchema = z.object({
  request: z.string().trim().min(1),
  mode: missionExecutionModeSchema.optional()
});

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createMissionRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: "INVALID_MISSION_REQUEST",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  let mode: "SIMULATION" | "LIVE";
  try {
    mode = parsed.data.mode ?? readDefaultMissionExecutionMode();
  } catch (error) {
    console.error("Invalid SABI_DEFAULT_MISSION_MODE", error);
    return Response.json(
      { error: "MISSION_MODE_CONFIGURATION_INVALID" },
      { status: 503 }
    );
  }

  const bimpeConfigured = mode === "LIVE" && isBimpeMissionOrchestrationConfigured();
  if (mode === "LIVE" && !bimpeConfigured) {
    console.warn("SABI live mission creation blocked: agent is not configured", {
      missingConfiguration: missingBimpeMissionConfiguration()
    });
    return Response.json({
      error: "LIVE_AGENT_NOT_CONFIGURED",
      message: "SABI’s live agent connection needs setup before a mission can start. Please contact the SABI team. No mission was created."
    }, { status: 503 });
  }

  try {
    let persisted = await createPersistedMission(parsed.data.request, mode);

    if (bimpeConfigured) {
      persisted = await saveMissionSnapshot({
        ...persisted, steps: [...persisted.steps, buildBimpeHandoffStep(persisted.mission.id)]
      });
      waitUntil(
        dispatchBimpeMissionStart(persisted).catch((error) => {
          console.error(
            `Bimpe handoff status could not be saved for ${persisted.mission.id}`,
            error
          );
        })
      );
    }

    return Response.json(
      {
        ...persisted,
        persisted: true,
        orchestrationMode: mode,
        agentHandoff: {
          provider: "BimpeAI",
          scheduled: bimpeConfigured,
          correlation: bimpeConfigured ? persisted.mission.id : undefined
        },
        disclaimer:
          mode === "SIMULATION"
            ? "Mission created in simulation mode. Provider evidence will be clearly mocked."
            : bimpeConfigured
              ? "Live mission created and handed to BimpeAI. External provider action occurs only through the consent-gated live tools, and every consequential action stops for human approval."
              : "Live mission created. No external action occurs because BimpeAI orchestration is not configured; no provider contact was initiated."
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { error: "INVALID_MISSION_REQUEST", details: error.flatten() },
        { status: 400 }
      );
    }

    console.error("Failed to persist mission snapshot", error);

    return Response.json(
      {
        error: "MISSION_PERSISTENCE_UNAVAILABLE",
        message:
          "SABI could structure the mission but could not persist it. No mission was created."
      },
      { status: 503 }
    );
  }
}
