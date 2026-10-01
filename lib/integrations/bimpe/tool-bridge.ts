import { timingSafeEqual } from "node:crypto";
import { ZodError, z } from "zod";
import type { CommunicationAdapter } from "../communication/types";
import {
  createNeonApprovalRepositoryFromEnvironment,
  NeonApprovalRepositoryConfigurationError,
  NeonApprovalRepositoryError
} from "../neon/approval-repository";
import {
  createNeonQuoteRepositoryFromEnvironment,
  NeonQuoteRepositoryConfigurationError,
  NeonQuoteRepositoryError
} from "../neon/quote-repository";
import type { ApprovalRepository } from "../../repositories/approval-repository";
import type { QuoteRepository } from "../../repositories/quote-repository";
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
  searchProvidersInputSchema,
  sendMessage,
  sendMessageInputSchema,
  type MessageTransport
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
  messageTransport?: MessageTransport;
  quoteLookup?: QuoteLookup;
  quoteRepository?: QuoteRepository;
  approvalRepository?: ApprovalRepository;
  environment?: BimpeToolEnvironment;
};

export const bimpeToolNameSchema = z.enum([
  "searchProviders",
  "getProvider",
  "callProvider",
  "sendMessage",
  "recordQuote",
  "requestApproval"
]);

export type BimpeToolName = z.infer<typeof bimpeToolNameSchema>;

/**
 * These are the five Bimpe Custom API actions already configured in the
 * hackathon workflow. sendMessage is intentionally available as a SABI route
 * without silently adding a sixth Bimpe action; enable that action explicitly
 * once the team chooses to expose the SMS fallback to the workflow.
 */
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

  if (error instanceof NeonQuoteRepositoryConfigurationError) {
    return Response.json(
      {
        error: "QUOTE_REPOSITORY_CONFIGURATION_INVALID",
        message: error.message
      },
      { status: 503 }
    );
  }

  if (error instanceof NeonApprovalRepositoryConfigurationError) {
    return Response.json(
      {
        error: "APPROVAL_REPOSITORY_CONFIGURATION_INVALID",
        message: error.message
      },
      { status: 503 }
    );
  }

  if (error instanceof NeonQuoteRepositoryError) {
    return Response.json(
      {
        error: "QUOTE_REPOSITORY_UNAVAILABLE",
        message: "Durable Quote storage is temporarily unavailable."
      },
      { status: 503 }
    );
  }

  if (error instanceof NeonApprovalRepositoryError) {
    return Response.json(
      {
        error: "APPROVAL_REPOSITORY_UNAVAILABLE",
        message: "Durable Approval storage is temporarily unavailable."
      },
      { status: 503 }
    );
  }

  const message = error instanceof Error ? error.message : "Agent tool failed.";

  if (
    message.startsWith("Provider not found:") ||
    message.startsWith("Quote not found:")
  ) {
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

function resolveQuoteRepository(
  dependencies: BimpeToolBridgeDependencies,
  environment: BimpeToolEnvironment
): QuoteRepository | undefined {
  return (
    dependencies.quoteRepository ??
    createNeonQuoteRepositoryFromEnvironment(environment)
  );
}

function resolveApprovalRepository(
  dependencies: BimpeToolBridgeDependencies,
  environment: BimpeToolEnvironment
): ApprovalRepository | undefined {
  return (
    dependencies.approvalRepository ??
    createNeonApprovalRepositoryFromEnvironment(environment)
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

      case "sendMessage": {
        const input = sendMessageInputSchema.parse(body);
        const communication = await sendMessage(
          input,
          dependencies.messageTransport
        );

        return Response.json({
          tool: toolName,
          data: communication,
          meta: {
            transportConfigured: Boolean(dependencies.messageTransport),
            externalMessageAccepted: Boolean(communication.externalId),
            initiationOnly: communication.status === "INITIATED",
            quoteCreated: false
          }
        });
      }

      case "recordQuote": {
        const repository = resolveQuoteRepository(dependencies, environment);

        if (!repository) {
          return Response.json(
            {
              error: "QUOTE_REPOSITORY_NOT_CONFIGURED",
              message:
                "Durable Quote persistence requires a Neon/Postgres DATABASE_URL."
            },
            { status: 503 }
          );
        }

        const input = recordQuoteInputSchema.parse(body);
        const quote = recordQuote(input);
        const storedQuote = await repository.save(quote);

        return Response.json({
          tool: toolName,
          data: storedQuote,
          meta: {
            persisted: true,
            storage: "neon-postgres"
          }
        });
      }

      case "requestApproval": {
        const input = requestApprovalInputSchema.parse(body);

        if (dependencies.quoteLookup) {
          const approval = requestApproval(input, dependencies.quoteLookup);
          const explicitApprovalRepository = dependencies.approvalRepository;
          const storedApproval = explicitApprovalRepository
            ? await explicitApprovalRepository.save(approval)
            : approval;

          return Response.json({
            tool: toolName,
            data: storedApproval,
            meta: {
              transactionCommitted: false,
              approvalPersisted: Boolean(explicitApprovalRepository),
              message: explicitApprovalRepository
                ? "Pending human approval persisted; no purchase, booking, payment, or fund transfer occurred."
                : "Pending human approval created for an injected Quote lookup; no purchase, booking, payment, or fund transfer occurred."
            }
          });
        }

        const quoteRepository = resolveQuoteRepository(
          dependencies,
          environment
        );

        if (!quoteRepository) {
          return Response.json(
            {
              error: "APPROVAL_QUOTE_LOOKUP_NOT_CONFIGURED",
              message:
                "Request approval requires durable Quote storage or an explicit Quote lookup."
            },
            { status: 503 }
          );
        }

        const approvalRepository = resolveApprovalRepository(
          dependencies,
          environment
        );

        if (!approvalRepository) {
          return Response.json(
            {
              error: "APPROVAL_REPOSITORY_NOT_CONFIGURED",
              message:
                "Durable Approval persistence requires a Neon/Postgres DATABASE_URL or an explicit Approval repository."
            },
            { status: 503 }
          );
        }

        const quote = await quoteRepository.getById(input.quoteId);
        const approval = requestApproval(input, (quoteId) =>
          quote?.id === quoteId ? quote : undefined
        );
        const storedApproval = await approvalRepository.save(approval);

        return Response.json({
          tool: toolName,
          data: storedApproval,
          meta: {
            transactionCommitted: false,
            approvalPersisted: true,
            approvalStorage: "neon-postgres",
            quoteLoadedFromRepository: true,
            message:
              "Pending human approval persisted from a stored Quote; no purchase, booking, payment, or fund transfer occurred."
          }
        });
      }
    }
  } catch (error) {
    return toolErrorResponse(error);
  }
}
