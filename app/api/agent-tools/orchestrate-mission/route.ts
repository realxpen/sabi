import { z } from "zod";
import { authorizeAgentToolRequest } from "../../../../lib/integrations/bimpe/agent-tool-auth";
import { createConfiguredCommunicationAdapter } from "../../../../lib/integrations/communication/live-runtime";
import { getMissionSnapshot } from "../../../../lib/integrations/neon/mission-snapshot-repository";
import { advanceMissionOrchestration } from "../../../../lib/mission/orchestrator";

export const runtime = "nodejs";

const inputSchema = z.object({
  missionId: z.string().trim().min(1),
  mode: z.enum(["SIMULATION", "LIVE"]).default("SIMULATION")
});

export async function POST(request: Request): Promise<Response> {
  const authFailure = authorizeAgentToolRequest(request);
  if (authFailure) return authFailure;

  const body = await request.json().catch(() => null);
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "INVALID_AGENT_TOOL_INPUT", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { missionId, mode } = parsed.data;

  try {
    const snapshot = await getMissionSnapshot(missionId);
    if (!snapshot) {
      return Response.json({ error: "MISSION_NOT_FOUND" }, { status: 404 });
    }

    console.info("SABI orchestration requested", {
      missionId,
      mode,
      currentStatus: snapshot.mission.status
    });

    if (mode === "LIVE") {
      const communicationMode = process.env.SABI_COMMUNICATION_MODE?.trim();
      if (communicationMode !== "bimpe" && communicationMode !== "vapi-kros") {
        return Response.json(
          {
            error: "LIVE_COMMUNICATION_NOT_ENABLED",
            message: "Live orchestration is disabled. No provider was contacted."
          },
          { status: 503 }
        );
      }
    }

    // The agent-tool orchestration endpoint is state progression only.
    // Provider contact is performed exclusively by the separately guarded
    // /api/agent-tools/call-provider action so an extra orchestration call
    // can never initiate a duplicate or premature live call.
    if (snapshot.mission.status === "CONTACTING") {
      console.info("SABI orchestration checkpoint", {
        missionId,
        status: snapshot.mission.status,
        reason: "READY_FOR_PROVIDER_CALL"
      });

      return Response.json({
        tool: "orchestrateMission",
        data: {
          missionId,
          status: "CONTACTING",
          outcome: "CHECKPOINT",
          reason: "READY_FOR_PROVIDER_CALL"
        },
        meta: {
          persisted: true,
          providerContactInitiated: false,
          transactionPerformed: false
        }
      });
    }

    const result = await advanceMissionOrchestration(missionId, {
      mode,
      communicationAdapter:
        mode === "LIVE" ? createConfiguredCommunicationAdapter() : undefined
    });

    console.info("SABI orchestration advanced", {
      missionId,
      fromStatus: snapshot.mission.status,
      toStatus: result.snapshot.mission.status,
      outcome: result.outcome,
      reason: result.reason
    });

    return Response.json({
      tool: "orchestrateMission",
      data: {
        missionId,
        status: result.snapshot.mission.status,
        outcome: result.outcome,
        reason: result.reason
      },
      meta: {
        persisted: true,
        providerContactInitiated: false,
        transactionPerformed: false
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AGENT_TOOL_FAILED";

    if (message === "SIMULATION_NOT_ALLOWED_FOR_LIVE_MISSION") {
      return Response.json({ error: message }, { status: 409 });
    }

    return Response.json({ error: "AGENT_TOOL_FAILED", message }, { status: 500 });
  }
}
