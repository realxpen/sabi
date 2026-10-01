import { ZodError, z } from "zod";
import { authorizeAgentToolRequest } from "../../../../lib/integrations/bimpe/agent-tool-auth";
import {
  agentProviderModeSchema,
  compareQuotesForAgent,
  getProviderForAgent,
  recordProviderResponseForAgent,
  recordProviderResponseToolInputSchema,
  recordQuoteForAgent,
  recordQuoteToolInputSchema,
  requestHumanApprovalForAgent,
  searchProvidersForAgent,
  searchProvidersToolInputSchema
} from "../../../../lib/integrations/bimpe/tools";
import { createConfiguredCommunicationAdapter } from "../../../../lib/integrations/communication/live-runtime";
import { advanceMissionOrchestration } from "../../../../lib/mission/orchestrator";

export const runtime = "nodejs";

const toolSchema = z.enum([
  "search-providers",
  "get-provider",
  "record-provider-response",
  "record-quote",
  "compare-quotes",
  "orchestrate-mission",
  "request-approval"
]);

const getProviderInputSchema = z.object({
  providerId: z.string().trim().min(1),
  mode: agentProviderModeSchema.default("SIMULATION")
});

const missionIdInputSchema = z.object({
  missionId: z.string().trim().min(1)
});

const orchestrateMissionInputSchema = z.object({
  missionId: z.string().trim().min(1),
  mode: z.enum(["SIMULATION", "LIVE"]).default("SIMULATION")
});

function errorResponse(error: unknown): Response {
  if (error instanceof ZodError) {
    return Response.json(
      { error: "INVALID_AGENT_TOOL_INPUT", details: error.flatten() },
      { status: 400 }
    );
  }

  const message = error instanceof Error ? error.message : "AGENT_TOOL_FAILED";

  if (
    message === "MISSION_NOT_FOUND" ||
    message === "COMMUNICATION_NOT_FOUND"
  ) {
    return Response.json({ error: message }, { status: 404 });
  }

  if (message === "LIVE_PROVIDER_DIRECTORY_NOT_CONFIGURED") {
    return Response.json(
      {
        error: message,
        message:
          "SABI has no verified live provider directory yet. Demo fixtures were not returned."
      },
      { status: 503 }
    );
  }

  if (
    message === "QUOTE_PROVIDER_MISMATCH" ||
    message === "RECOMMENDATION_NOT_READY" ||
    message === "MISSION_NOT_READY_FOR_APPROVAL_REQUEST" ||
    message === "MISSION_NOT_READY_FOR_QUOTE_RECORDING" ||
    message === "MISSION_NOT_READY_FOR_COMPARISON" ||
    message === "QUOTES_NOT_READY" ||
    message === "SIMULATION_NOT_ALLOWED_FOR_LIVE_MISSION" ||
    message === "COMMUNICATION_MISSION_MISMATCH" ||
    message === "COMMUNICATION_NOT_COMPLETED" ||
    message === "COMMUNICATION_PROVIDER_MISMATCH" ||
    message === "MOCK_EVIDENCE_NOT_ALLOWED_FOR_LIVE_MISSION"
  ) {
    return Response.json({ error: message }, { status: 409 });
  }

  if (message === "LIVE_COMMUNICATION_ADAPTER_REQUIRED") {
    return Response.json({ error: message }, { status: 503 });
  }

  return Response.json({ error: "AGENT_TOOL_FAILED", message }, { status: 500 });
}

export async function POST(
  request: Request,
  { params }: { params: { tool: string } }
): Promise<Response> {
  const authFailure = authorizeAgentToolRequest(request);
  if (authFailure) return authFailure;

  const tool = toolSchema.safeParse(params.tool);
  if (!tool.success) {
    return Response.json({ error: "UNKNOWN_AGENT_TOOL" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));

  try {
    switch (tool.data) {
      case "search-providers": {
        const input = searchProvidersToolInputSchema.parse(body);
        const providers = searchProvidersForAgent(input);
        return Response.json({
          tool: "searchProviders",
          data: providers,
          meta: {
            source: "explicit-simulation-provider-fixtures",
            liveDirectory: false
          }
        });
      }

      case "get-provider": {
        const input = getProviderInputSchema.parse(body);
        const provider = getProviderForAgent(input.providerId, input.mode);
        if (!provider) {
          return Response.json({ error: "PROVIDER_NOT_FOUND" }, { status: 404 });
        }
        return Response.json({
          tool: "getProvider",
          data: provider,
          meta: {
            source: "explicit-simulation-provider-fixtures",
            liveDirectory: false
          }
        });
      }

      case "record-provider-response": {
        const input = recordProviderResponseToolInputSchema.parse(body);
        const result = await recordProviderResponseForAgent(input);
        return Response.json({
          tool: "recordProviderResponse",
          data: result.quote,
          meta: {
            persisted: true,
            communicationId: input.communicationId,
            evidenceSourceReference: result.quote.sourceReference,
            recommendationChanged: false
          }
        });
      }

      case "record-quote": {
        const input = recordQuoteToolInputSchema.parse(body);
        const snapshot = await recordQuoteForAgent(input);
        return Response.json({
          tool: "recordQuote",
          data: input.quote,
          meta: {
            persisted: true,
            missionStatus: snapshot.mission.status,
            recommendationChanged: false
          }
        });
      }

      case "compare-quotes": {
        const { missionId } = missionIdInputSchema.parse(body);
        const result = await compareQuotesForAgent(missionId);
        return Response.json({
          tool: "compareQuotes",
          data: result.intelligence,
          recommendation: result.snapshot.recommendation,
          meta: {
            persisted: true,
            consequentialActionPerformed: false
          }
        });
      }

      case "orchestrate-mission": {
        const input = orchestrateMissionInputSchema.parse(body);

        if (
          input.mode === "LIVE" &&
          process.env.SABI_COMMUNICATION_MODE?.trim() !== "vapi-kros"
        ) {
          return Response.json(
            {
              error: "LIVE_COMMUNICATION_NOT_ENABLED",
              message:
                "Live orchestration is disabled. No provider was contacted."
            },
            { status: 503 }
          );
        }

        const result = await advanceMissionOrchestration(input.missionId, {
          mode: input.mode,
          communicationAdapter:
            input.mode === "LIVE"
              ? createConfiguredCommunicationAdapter()
              : undefined
        });

        return Response.json({
          tool: "orchestrateMission",
          data: {
            missionId: input.missionId,
            status: result.snapshot.mission.status,
            outcome: result.outcome,
            reason: result.reason
          },
          meta: {
            persisted: true,
            transactionPerformed: false
          }
        });
      }

      case "request-approval": {
        const { missionId } = missionIdInputSchema.parse(body);
        const snapshot = await requestHumanApprovalForAgent(missionId);
        return Response.json({
          tool: "requestApproval",
          data: {
            missionId,
            status: snapshot.mission.status,
            recommendation: snapshot.recommendation
          },
          meta: {
            humanDecisionPending: true,
            transactionPerformed: false
          }
        });
      }
    }
  } catch (error) {
    return errorResponse(error);
  }
}
