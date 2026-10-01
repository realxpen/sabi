import { timingSafeEqual } from "node:crypto";
import { runMissionIntelligence } from "../../../../../lib/mission/intelligence-runtime";

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
  context: { params: { id: string } }
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
    const result = await runMissionIntelligence(context.params.id);

    return Response.json({
      missionId: context.params.id,
      intelligence: result.intelligence,
      recommendation: result.snapshot.recommendation,
      persisted: true,
      approvalRequired: result.snapshot.mission.approvalRequired,
      consequentialActionPerformed: false
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Mission intelligence failed.";

    if (message === "MISSION_NOT_FOUND") {
      return Response.json(
        { error: "MISSION_NOT_FOUND" },
        { status: 404 }
      );
    }

    return Response.json(
      { error: "MISSION_INTELLIGENCE_FAILED", message },
      { status: 500 }
    );
  }
}
