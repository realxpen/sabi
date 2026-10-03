import { ZodError } from "zod";
import { authorizeAgentToolRequest } from "../../../../lib/integrations/bimpe/agent-tool-auth";
import {
  updateMissionConstraintsForAgent,
  updateMissionConstraintsToolInputSchema
} from "../../../../lib/integrations/bimpe/mission-constraints";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const authFailure = authorizeAgentToolRequest(request);
  if (authFailure) return authFailure;

  const body = await request.json().catch(() => ({}));

  try {
    const input = updateMissionConstraintsToolInputSchema.parse(body);
    const result = await updateMissionConstraintsForAgent(input);

    return Response.json({
      tool: "updateMissionConstraints",
      data: {
        missionId: result.snapshot.mission.id,
        status: result.snapshot.mission.status,
        previousBudget: result.previousBudget,
        budget: result.budget,
        changed: result.changed
      },
      meta: {
        persisted: true,
        humanConfirmed: true,
        recommendationCleared: result.changed,
        communicationInitiated: false,
        quoteChanged: false,
        transactionPerformed: false
      }
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { error: "INVALID_AGENT_TOOL_INPUT", details: error.flatten() },
        { status: 400 }
      );
    }

    const message =
      error instanceof Error ? error.message : "UPDATE_MISSION_CONSTRAINTS_FAILED";

    if (message === "MISSION_NOT_FOUND") {
      return Response.json({ error: message }, { status: 404 });
    }

    if (message === "MISSION_NOT_READY_FOR_CONSTRAINT_UPDATE") {
      return Response.json({ error: message }, { status: 409 });
    }

    return Response.json(
      { error: "UPDATE_MISSION_CONSTRAINTS_FAILED", message },
      { status: 500 }
    );
  }
}
