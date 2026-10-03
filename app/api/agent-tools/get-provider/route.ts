import { ZodError, z } from "zod";
import { authorizeAgentToolRequest } from "../../../../lib/integrations/bimpe/agent-tool-auth";
import {
  agentProviderModeSchema,
  getProviderForAgent
} from "../../../../lib/integrations/bimpe/tools";
import { getRegisteredProvider } from "../../../../lib/integrations/neon/provider-registry";

export const runtime = "nodejs";

const inputSchema = z.object({
  providerId: z.string().trim().min(1),
  mode: agentProviderModeSchema.default("SIMULATION")
});

export async function POST(request: Request): Promise<Response> {
  const authFailure = authorizeAgentToolRequest(request);
  if (authFailure) return authFailure;

  const body = await request.json().catch(() => ({}));

  try {
    const input = inputSchema.parse(body);

    if (input.mode === "LIVE") {
      const registered = await getRegisteredProvider(input.providerId);
      if (registered) {
        return Response.json({
          tool: "getProvider",
          data: registered,
          meta: {
            source: "persisted-live-provider-registry",
            dialingNumberExposed: false
          }
        });
      }
    }

    const provider = getProviderForAgent(input.providerId, input.mode);
    if (!provider) {
      return Response.json({ error: "PROVIDER_NOT_FOUND" }, { status: 404 });
    }

    return Response.json({
      tool: "getProvider",
      data: provider,
      meta: {
        source:
          input.mode === "LIVE"
            ? "configured-live-test-provider-metadata"
            : "explicit-simulation-provider-fixtures",
        dialingNumberExposed: false
      }
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { error: "INVALID_AGENT_TOOL_INPUT", details: error.flatten() },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "GET_PROVIDER_FAILED";
    if (message === "LIVE_PROVIDER_DIRECTORY_NOT_CONFIGURED") {
      return Response.json({ error: "PROVIDER_NOT_FOUND" }, { status: 404 });
    }

    return Response.json({ error: "GET_PROVIDER_FAILED", message }, { status: 500 });
  }
}
