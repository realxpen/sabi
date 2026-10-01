import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createConfiguredCommunicationAdapter } from "../../../../lib/integrations/communication/live-runtime";
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
    const adapter = createConfiguredCommunicationAdapter();
    const communication = await adapter.initiateContact(parsed.data);
    await persistCommunicationResultToMission(communication);

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
