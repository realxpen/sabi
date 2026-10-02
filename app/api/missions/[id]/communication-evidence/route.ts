import { timingSafeEqual } from "node:crypto";
import { ZodError } from "zod";
import {
  recordStructuredCommunicationEvidence,
  structuredCommunicationEvidenceInputSchema
} from "../../../../../lib/mission/structured-evidence";

export const runtime = "nodejs";

function authorized(request: Request): boolean {
  const expected = process.env.SABI_AGENT_TOOL_TOKEN?.trim();
  const presented = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1]
    ?.trim();

  if (!expected || !presented) return false;

  const expectedBytes = Buffer.from(expected);
  const presentedBytes = Buffer.from(presented);

  return (
    expectedBytes.length === presentedBytes.length &&
    timingSafeEqual(expectedBytes, presentedBytes)
  );
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  if (!process.env.SABI_AGENT_TOOL_TOKEN?.trim()) {
    return Response.json(
      { error: "AGENT_TOOL_AUTH_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  if (!authorized(request)) {
    return Response.json(
      { error: "UNAUTHORIZED_AGENT_TOOL_REQUEST" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const input = structuredCommunicationEvidenceInputSchema.parse(body);
    const result = await recordStructuredCommunicationEvidence(params.id, input);

    return Response.json({
      missionId: params.id,
      communication: result.communication,
      quote: result.quote,
      missionStatus: result.snapshot.mission.status,
      recommendation: result.snapshot.recommendation,
      persisted: true,
      consequentialActionPerformed: false
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { error: "INVALID_COMMUNICATION_EVIDENCE", details: error.flatten() },
        { status: 400 }
      );
    }

    const message =
      error instanceof Error ? error.message : "COMMUNICATION_EVIDENCE_FAILED";

    if (message === "MISSION_NOT_FOUND" || message === "COMMUNICATION_NOT_FOUND") {
      return Response.json({ error: message }, { status: 404 });
    }

    if (
      message === "COMMUNICATION_NOT_COMPLETED" ||
      message === "COMMUNICATION_MISSION_MISMATCH" ||
      message === "QUOTE_EVIDENCE_INCOMPLETE"
    ) {
      return Response.json({ error: message }, { status: 409 });
    }

    console.error("Failed to record communication evidence", error);
    return Response.json(
      {
        error: "COMMUNICATION_EVIDENCE_FAILED",
        message:
          "SABI stopped safely. No Quote was fabricated and no consequential action was performed."
      },
      { status: 500 }
    );
  }
}
