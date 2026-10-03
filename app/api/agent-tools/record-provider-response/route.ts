import { ZodError } from "zod";
import { authorizeAgentToolRequest } from "../../../../lib/integrations/bimpe/agent-tool-auth";
import {
  recordProviderResponseForAgent,
  recordProviderResponseToolInputSchema
} from "../../../../lib/integrations/bimpe/tools";

export const runtime = "nodejs";

function normalizedNotes(notes: unknown): string {
  return typeof notes === "string" ? notes.trim().toLowerCase() : "";
}

function explicitlyMarksAllMonetaryFactsUnknown(notes: unknown): boolean {
  const normalized = normalizedNotes(notes);
  if (!normalized) return false;

  return (
    normalized.includes("no exact price, delivery fee, or total was stated") ||
    normalized.includes("price, delivery fee, and total are unknown") ||
    normalized.includes("price, delivery fee and total are unknown")
  );
}

function explicitlyMarksPriceUnknown(notes: unknown): boolean {
  const normalized = normalizedNotes(notes);
  if (!normalized) return false;

  return (
    explicitlyMarksAllMonetaryFactsUnknown(notes) ||
    normalized.includes("food subtotal was not stated") ||
    normalized.includes("food price before delivery was not stated") ||
    normalized.includes("price before delivery was not stated") ||
    normalized.includes("separate food price was not stated")
  );
}

function explicitlyMarksDeliveryFeeUnknown(notes: unknown): boolean {
  const normalized = normalizedNotes(notes);
  if (!normalized) return false;

  return (
    explicitlyMarksAllMonetaryFactsUnknown(notes) ||
    normalized.includes("separate delivery fee was not stated") ||
    normalized.includes("delivery fee was not stated separately") ||
    normalized.includes("no separate delivery fee was stated")
  );
}

function explicitlyMarksTotalUnknown(notes: unknown): boolean {
  const normalized = normalizedNotes(notes);
  if (!normalized) return false;

  return (
    explicitlyMarksAllMonetaryFactsUnknown(notes) ||
    normalized.includes("total is unknown") ||
    normalized.includes("total was not stated")
  );
}

function isZeroTransportDefault(value: unknown): boolean {
  if (value === 0) return true;
  if (typeof value !== "string") return false;

  const normalized = value.trim();
  if (!normalized) return false;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed === 0;
}

function sanitizeBimpeMoneyDefaults(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;

  const sanitized = { ...(body as Record<string, unknown>) };

  // Bimpe custom API number fields may arrive as numeric or string zero when
  // the agent means "unknown". Strip only the specific zero-valued fields that
  // the evidence notes explicitly identify as unstated. This preserves a real
  // provider-stated zero (for example free delivery), while allowing a known
  // all-in total to coexist with an unknown subtotal or delivery breakdown.
  if (
    explicitlyMarksPriceUnknown(sanitized.notes) &&
    isZeroTransportDefault(sanitized.price)
  ) {
    delete sanitized.price;
  }

  if (
    explicitlyMarksDeliveryFeeUnknown(sanitized.notes) &&
    isZeroTransportDefault(sanitized.deliveryFee)
  ) {
    delete sanitized.deliveryFee;
  }

  if (
    explicitlyMarksTotalUnknown(sanitized.notes) &&
    isZeroTransportDefault(sanitized.total)
  ) {
    delete sanitized.total;
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

    const sanitizedNotes = (sanitizedBody as Record<string, unknown>)?.notes;

    return Response.json({
      tool: "recordProviderResponse",
      data: result.quote,
      meta: {
        persisted: true,
        communicationId: input.communicationId,
        evidenceSourceReference: result.quote.sourceReference,
        recommendationChanged: false,
        unknownMonetaryFactsPreserved:
          explicitlyMarksPriceUnknown(sanitizedNotes) ||
          explicitlyMarksDeliveryFeeUnknown(sanitizedNotes) ||
          explicitlyMarksTotalUnknown(sanitizedNotes)
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
