import { ZodError } from "zod";
import { authorizeAgentToolRequest } from "../../../../lib/integrations/bimpe/agent-tool-auth";
import {
  getMissionStateForAgent,
  getMissionStateToolInputSchema
} from "../../../../lib/integrations/bimpe/mission-state";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const authFailure = authorizeAgentToolRequest(request);
  if (authFailure) return authFailure;

  const body = await request.json().catch(() => ({}));

  try {
    const input = getMissionStateToolInputSchema.parse(body);
    const state = await getMissionStateForAgent(input);

    return Response.json({
      tool: "getMissionState",
      data: state,
      meta: {
        persisted: true,
        readOnly: true,
        communicationInitiated: false,
        quoteCreated: false,
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

    const message = error instanceof Error ? error.message : "GET_MISSION_STATE_FAILED";
    if (message === "MISSION_NOT_FOUND") {
      return Response.json({ error: message }, { status: 404 });
    }

    return Response.json(
      { error: "GET_MISSION_STATE_FAILED", message },
      { status: 500 }
    );
  }
}
