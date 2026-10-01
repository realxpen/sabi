import { randomUUID } from "crypto";
import { z } from "zod";
import { saveMissionSnapshot } from "../../../lib/integrations/neon/mission-snapshot-repository";
import { buildInitialMissionSnapshot } from "../../../lib/mission/initial-snapshot";

const createMissionRequestSchema = z.object({
  request: z.string().trim().min(1),
  mode: z.enum(["SIMULATION", "LIVE"]).default("SIMULATION")
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

  const snapshot = buildInitialMissionSnapshot(
    parsed.data.request,
    `mission-${randomUUID()}`,
    parsed.data.mode === "SIMULATION"
  );

  try {
    const persisted = await saveMissionSnapshot(snapshot);

    return Response.json(
      {
        ...persisted,
        persisted: true,
        orchestrationMode: parsed.data.mode,
        disclaimer:
          parsed.data.mode === "SIMULATION"
            ? "Mission created in simulation mode. Provider evidence will be clearly mocked."
            : "Live mission created. No external action occurs until authenticated orchestration explicitly advances it."
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
