import { timingSafeEqual } from "node:crypto";
import { ZodError, z } from "zod";
import type { CommunicationAdapter } from "../communication/types";
import type { QuoteLookup } from "../../tools/approval-tools";
import {
  requestApproval,
  requestApprovalInputSchema
} from "../../tools/approval-tools";
import {
  callProvider,
  callProviderInputSchema,
  getProvider,
  searchProviders,
  searchProvidersInputSchema
} from "../../tools/provider-tools";
import {
  recordQuote,
  recordQuoteInputSchema
} from "../../tools/quote-tools";

const requiredTokenKey = "SABI_AGENT_TOOL_TOKEN" as const;

export type BimpeToolEnvironment = {
  [key: string]: string | undefined;
};

export type BimpeToolBridgeDependencies = {
  communicationAdapter?: CommunicationAdapter;
  quoteLookup?: QuoteLookup;
  environment?: BimpeToolEnvironment;
};

export const bimpeToolNameSchema = z.enum([
  "searchProviders",
  "getProvider",
  "callProvider",
  "recordQuote",
  "requestApproval"
]);

export type BimpeToolName = z.infer<typeof bimpeToolNameSchema>;

export const bimpeCustomApiTools = [
  {
    name: "Search Providers",
    http_method: "POST",
    url_template: "/api/agent-tools/search-providers"
  },
  {
    name: "Get Provider",
    http_method: "POST",
    url_template: "/api/agent-tools/get-provider"
  },
  {
    name: "Call Provider",
    http_method: "POST",
    url_template: "/api/agent-tools/call-provider"
  },
  {
    name: "Record Quote",
    http_method: "POST",
    url_template: "/api/agent-tools/record-quote"
  },
  {
    name: "Request Approval",
    http_method: "POST",
    url_template: "/api/agent-tools/request-approval"
  }
] as const;

function safeTokenEquals(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);

  if (actualBytes.length !== expectedBytes.length) {
    return false;
  }

  return timingSafeEqual(actualBytes, expectedBytes);
}

function authorizeRequest(
  request: Request,
  environment: BimpeToolEnvironment
): Response | undefined {
  const expectedToken = environment[requiredTokenKey]?.trim();

  if (!expectedToken) {
    return Response.json(
      {
        error: "AGENT_TOOL_AUTH_NOT_CONFIGURED",
        message: `${requiredTokenKey} is not configured.`
      },
      { status: 503 }
    );
  }

  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  const presentedToken = match?.[1]?.trim();

  if (!presentedToken || !safeTokenEquals(presentedToken, expectedToken)) {
    return Response.json(
      { error: "UNAUTHORIZED_AGENT_TOOL_REQUEST" },
      { status: 401 }
    );
  }

  return undefined;
}

async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ZodError([
      {
        code: "custom",
        path: [],
        message: "Request body must be valid JSON."
      }
    ]);
  }
}

function toolErrorResponse(error: unknown): Response {
  if (error instanceof ZodError) {
    return Response.json(
      {
        error: "INVALID_AGENT_TOOL_INPUT",
        details: error.flatten()
      },
      { status: 400 }
    );
  }

  const message = error instanceof Error ? error.message : "Agent tool failed.";

  if (message.startsWith("Provider not found:") || message.startsWith("Quote not found:")) {
    return Response.json(
      { error: "AGENT_TOOL_RESOURCE_NOT_FOUND", message },
      { status: 404 }
    );
  }

  if (
    message.includes("does not belong to") ||
    message.startsWith("Provider is inactive:")
  ) {
    return Response.json(
      { error: "AGENT_TOOL_CONFLICT", message },
      { status: 409 }
    );
  }

  return Response.json(
    { error: "AGENT_TOOL_FAILED", message },
    { status: 500 }
  );
}

export async function handleBimpeToolRequest(
  request: Request,
  toolName: BimpeToolName,
  dependencies: BimpeToolBridgeDependencies = {}
): Promise<Response> {
  const environment = dependencies.environment ?? process.env;
  const authFailure = authorizeRequest(request, environment);

  if (authFailure) {
    return authFailure;
  }

  let body: unknown;
  try {
    body = await parseJsonBody(request);
  } catch (error) {
    return toolErrorResponse(error);
  }

  try {
    switch (toolName) {
      case "searchProviders": {
        const input = searchProvidersInputSchema.parse(body);
        const providers = searchProviders(input);
        return Response.json({
          tool: toolName,
          data: providers,
          meta: {
            source: "temporary-demo-providers",
            liveDirectory: false
          }
        });
      }

      case "getProvider": {
        const input = z
          .object({ providerId: z.string().trim().min(1) })
          .parse(body);
        const provider = getProvider(input.providerId);

        if (!provider) {
          return Response.json(
            {
              error: "AGENT_TOOL_RESOURCE_NOT_FOUND",
              message: `Provider not found: ${input.providerId}`
            },
            { status: 404 }
          );
        }

        return Response.json({
          tool: toolName,
          data: provider,
          meta: {
            source: "temporary-demo-providers",
            liveDirectory: false
          }
        });
      }

      case "callProvider": {
        const input = callProviderInputSchema.parse(body);
        const communication = await callProvider(
          input,
          dependencies.communicationAdapter
        );

        return Response.json({
          tool: toolName,
          data: communication,
          meta: {
            liveCommunication: communication.channel !== "MOCK",
            initiationOnly: communication.status === "INITIATED"
          }
        });
      }

      case "recordQuote": {
        const input = recordQuoteInputSchema.parse(body);
        const quote = recordQuote(input);

        return Response.json({
          tool: toolName,
          data: quote,
          meta: {
            persisted: false,
            message:
              "Quote was validated and constructed only; no Quote repository is configured."
          }
        });
      }

      case "requestApproval": {
        if (!dependencies.quoteLookup) {
          return Response.json(
            {
              error: "APPROVAL_QUOTE_LOOKUP_NOT_CONFIGURED",
              message:
                "Request approval is unavailable until a Quote lookup/repository is configured."
            },
            { status: 503 }
          );
        }

        const input = requestApprovalInputSchema.parse(body);
        const approval = requestApproval(input, dependencies.quoteLookup);

        return Response.json({
          tool: toolName,
          data: approval,
          meta: {
            transactionCommitted: false,
            message:
              "Pending human approval created; no purchase, booking, payment, or fund transfer occurred."
          }
        });
      }
    }
  } catch (error) {
    return toolErrorResponse(error);
  }
}
