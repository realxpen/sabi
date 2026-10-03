import { ZodError } from "zod";
import { authorizeAgentToolRequest } from "../../../../lib/integrations/bimpe/agent-tool-auth";
import {
  searchProvidersForAgent,
  searchProvidersToolInputSchema
} from "../../../../lib/integrations/bimpe/tools";
import { listRegisteredProviders } from "../../../../lib/integrations/neon/provider-registry";

export const runtime = "nodejs";

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

export async function POST(request: Request): Promise<Response> {
  const authFailure = authorizeAgentToolRequest(request);
  if (authFailure) return authFailure;

  const body = await request.json().catch(() => ({}));

  try {
    const input = searchProvidersToolInputSchema.parse(body);

    if (input.mode !== "LIVE") {
      return Response.json({
        tool: "searchProviders",
        data: searchProvidersForAgent(input),
        meta: {
          source: "explicit-simulation-provider-fixtures",
          liveDirectory: false,
          dialingNumberExposed: false
        }
      });
    }

    let configured = [] as ReturnType<typeof searchProvidersForAgent>;
    try {
      configured = searchProvidersForAgent(input);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "LIVE_PROVIDER_DIRECTORY_NOT_CONFIGURED") {
        throw error;
      }
    }

    const registered = await listRegisteredProviders({
      query: input.query,
      category: input.category,
      location: input.location,
      verified: input.verified,
      active: input.active
    });

    return Response.json({
      tool: "searchProviders",
      data: uniqueById([...configured, ...registered]),
      meta: {
        source: "configured-and-persisted-live-provider-metadata",
        liveDirectory: true,
        registeredProviderCount: registered.length,
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

    const message = error instanceof Error ? error.message : "SEARCH_PROVIDERS_FAILED";
    return Response.json(
      { error: "SEARCH_PROVIDERS_FAILED", message },
      { status: 500 }
    );
  }
}
