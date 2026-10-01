import { randomUUID } from "crypto";
import { z } from "zod";
import { saveMissionSnapshot } from "../../../lib/integrations/neon/mission-snapshot-repository";
import { buildDemoMissionSnapshot } from "../../../lib/mission/demo-engine";

const createMissionRequestSchema = z.object({
  request: z.string().trim().min(1)
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createMissionRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: "INVALID_MISSION_REQUEST",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const snapshot = buildDemoMissionSnapshot(
    parsed.data.request,
    `mission-${randomUUID()}`
  );

  try {
    const persisted = await saveMissionSnapshot(snapshot);

    return Response.json(
      {
        ...persisted,
        persisted: true,
        disclaimer:
          "Demo provider evidence is still mocked, but this mission state is durably persisted."
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to persist mission snapshot", error);

    return Response.json(
      {
        error: "MISSION_PERSISTENCE_UNAVAILABLE",
        message:
          "SABI could structure the mission but could not persist it. No mission was created."
      },
      { status: 503 }
    );
  }
}
