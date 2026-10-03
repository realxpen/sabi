import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createConfiguredCommunicationAdapter } from "../../../../lib/integrations/communication/live-runtime";
import { getMissionSnapshot } from "../../../../lib/integrations/neon/mission-snapshot-repository";
import { persistCommunicationResultToMission } from "../../../../lib/mission/communication-runtime-sink";

export const runtime = "nodejs";

const inputSchema = z.object({
  missionId: z.string().trim().min(1),
  providerId: z.string().trim().min(1),
  objective: z.string().trim().min(1)
});

function authorized(request: Request): boolean {
  const expected = process.env.SABI_AGENT_TOOL_TOKEN?.trim();
  const presented = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!expected || !presented) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(presented);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.SABI_AGENT_TOOL_TOKEN?.trim()) {
    return Response.json({ error: "AGENT_TOOL_AUTH_NOT_CONFIGURED" }, { status: 503 });
  }

  if (!authorized(request)) {
    return Response.json({ error: "UNAUTHORIZED_AGENT_TOOL_REQUEST" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "INVALID_AGENT_TOOL_INPUT", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const snapshot = await getMissionSnapshot(parsed.data.missionId);
    if (!snapshot) {
      return Response.json({ error: "MISSION_NOT_FOUND" }, { status: 404 });
    }

    if (snapshot.mission.status !== "CONTACTING") {
      return Response.json(
        {
          error: "MISSION_NOT_READY_FOR_PROVIDER_CONTACT",
          missionStatus: snapshot.mission.status,
          message:
            "Provider contact is allowed only after the persisted mission reaches CONTACTING through bounded orchestration. No provider was contacted."
        },
        { status: 409 }
      );
    }

    if (!snapshot.providers.some((provider) => provider.id === parsed.data.providerId)) {
      return Response.json(
        {
          error: "PROVIDER_NOT_IN_MISSION",
          message: "The requested provider is not attached to this persisted mission. No provider was contacted."
        },
        { status: 409 }
      );
    }

    const existingCommunication = snapshot.communications.find(
      (communication) => communication.providerId === parsed.data.providerId
    );
    if (existingCommunication) {
      return Response.json(
        {
          error: "PROVIDER_ALREADY_CONTACTED",
          communicationId: existingCommunication.id,
          communicationStatus: existingCommunication.status,
          message:
            "This provider already has a persisted communication for the mission. No duplicate provider call was initiated."
        },
        { status: 409 }
      );
    }

    console.info("SABI provider call starting", {
      missionId: parsed.data.missionId,
      providerId: parsed.data.providerId,
      missionStatus: snapshot.mission.status
    });

    const adapter = createConfiguredCommunicationAdapter();
    const communication = await adapter.initiateContact(parsed.data);
    await persistCommunicationResultToMission(communication);

    console.info("SABI provider call persisted", {
      missionId: communication.missionId,
      providerId: communication.providerId,
      communicationId: communication.id,
      externalId: communication.externalId,
      status: communication.status,
      channel: communication.channel
    });

    return Response.json({
      tool: "callProvider",
      data: communication,
      meta: {
        liveCommunication: communication.channel !== "MOCK",
        initiationOnly: communication.status === "INITIATED",
        missionPersisted: true,
        quoteCreated: false
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Call provider failed.";
    return Response.json({ error: "CALL_PROVIDER_FAILED", message }, { status: 500 });
  }
}
