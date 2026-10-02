import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createConfiguredCommunicationAdapter } from "../../../../../lib/integrations/communication/live-runtime";
import { advanceMissionOrchestration } from "../../../../../lib/mission/orchestrator";

export const runtime = "nodejs";

const requestSchema = z.object({
  mode: z.enum(["SIMULATION", "LIVE"]).default("SIMULATION")
});

function safeTokenEquals(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(actualBytes, expectedBytes);
}

function authorizeLiveRequest(request: Request): Response | undefined {
  const expected = process.env.SABI_AGENT_TOOL_TOKEN?.trim();

  if (!expected) {
    return Response.json(
      { error: "LIVE_ORCHESTRATION_AUTH_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  const presented = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1]
    ?.trim();

  if (!presented || !safeTokenEquals(presented, expected)) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const communicationMode = process.env.SABI_COMMUNICATION_MODE?.trim();
  if (communicationMode !== "bimpe" && communicationMode !== "vapi-kros") {
    return Response.json(
      {
        error: "LIVE_COMMUNICATION_NOT_ENABLED",
        message:
          "Live orchestration requires SABI_COMMUNICATION_MODE=bimpe or vapi-kros. No provider was contacted."
      },
      { status: 503 }
    );
  }

  return undefined;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "INVALID_ORCHESTRATION_REQUEST", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (parsed.data.mode === "LIVE") {
    const authFailure = authorizeLiveRequest(request);
    if (authFailure) return authFailure;
  }

  try {
    const result = await advanceMissionOrchestration(params.id, {
      mode: parsed.data.mode,
      communicationAdapter:
        parsed.data.mode === "LIVE"
          ? createConfiguredCommunicationAdapter()
          : undefined
    });

    return Response.json({
      ...result,
      externalActionAttempted:
        parsed.data.mode === "LIVE" && result.snapshot.mission.status === "COLLECTING_QUOTES",
      transactionPerformed: false
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ORCHESTRATION_FAILED";

    if (message === "MISSION_NOT_FOUND") {
      return Response.json({ error: message }, { status: 404 });
    }

    if (message === "SIMULATION_NOT_ALLOWED_FOR_LIVE_MISSION") {
      return Response.json({ error: message }, { status: 409 });
    }

    if (message === "LIVE_COMMUNICATION_ADAPTER_REQUIRED") {
      return Response.json({ error: message }, { status: 503 });
    }

    console.error("Mission orchestration failed", error);
    return Response.json(
      {
        error: "MISSION_ORCHESTRATION_FAILED",
        message:
          "SABI stopped the mission safely. No purchase, booking or payment was performed."
      },
      { status: 500 }
    );
  }
}
