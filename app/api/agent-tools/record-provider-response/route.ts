import { ZodError } from "zod";
import { authorizeAgentToolRequest } from "../../../../lib/integrations/bimpe/agent-tool-auth";
import {
  recordProviderResponseForAgent,
  recordProviderResponseToolInputSchema
} from "../../../../lib/integrations/bimpe/tools";

export const runtime = "nodejs";

function explicitlyMarksMonetaryFactsUnknown(notes: unknown): boolean {
  if (typeof notes !== "string") return false;

  const normalized = notes.trim().toLowerCase();
  if (!normalized) return false;

  return (
    normalized.includes("no exact price, delivery fee, or total was stated") ||
    normalized.includes("price, delivery fee, and total are unknown") ||
    normalized.includes("price, delivery fee and total are unknown")
  );
}

function sanitizeBimpeMoneyDefaults(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;

  const sanitized = { ...(body as Record<string, unknown>) };

  // Bimpe custom API number fields may arrive as numeric 0 when the agent means
  // "unknown". Never turn that transport default into provider evidence. Only
  // strip the values when the evidence notes explicitly state that the monetary
  // facts were not provided. A real provider-stated zero (for example, free
  // delivery) remains valid when the notes do not mark it unknown.
  if (explicitlyMarksMonetaryFactsUnknown(sanitized.notes)) {
    if (sanitized.price === 0) delete sanitized.price;
    if (sanitized.deliveryFee === 0) delete sanitized.deliveryFee;
    if (sanitized.total === 0) delete sanitized.total;
  }

  return sanitized;
}

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

  if (
    message === "MISSION_NOT_READY_FOR_QUOTE_RECORDING" ||
    message === "COMMUNICATION_MISSION_MISMATCH" ||
    message === "COMMUNICATION_NOT_COMPLETED" ||
    message === "COMMUNICATION_PROVIDER_MISMATCH" ||
    message === "MOCK_EVIDENCE_NOT_ALLOWED_FOR_LIVE_MISSION"
  ) {
    return Response.json({ error: message }, { status: 409 });
  }

  return Response.json({ error: "AGENT_TOOL_FAILED", message }, { status: 500 });
}

export async function POST(request: Request): Promise<Response> {
  const authFailure = authorizeAgentToolRequest(request);
  if (authFailure) return authFailure;

  const body = await request.json().catch(() => ({}));

  try {
    const sanitizedBody = sanitizeBimpeMoneyDefaults(body);
    const input = recordProviderResponseToolInputSchema.parse(sanitizedBody);
    const result = await recordProviderResponseForAgent(input);

    return Response.json({
      tool: "recordProviderResponse",
      data: result.quote,
      meta: {
        persisted: true,
        communicationId: input.communicationId,
        evidenceSourceReference: result.quote.sourceReference,
        recommendationChanged: false,
        unknownMonetaryFactsPreserved:
          explicitlyMarksMonetaryFactsUnknown(
            (sanitizedBody as Record<string, unknown>)?.notes
          )
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
