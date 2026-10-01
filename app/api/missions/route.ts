import { ZodError, z } from "zod";
import {
  createPersistedMission,
  readDefaultMissionExecutionMode
} from "../../../lib/mission/create-mission";

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

  let mode: "SIMULATION" | "LIVE";
  try {
    mode = readDefaultMissionExecutionMode();
  } catch (error) {
    console.error("Invalid SABI_DEFAULT_MISSION_MODE", error);
    return Response.json(
      { error: "MISSION_MODE_CONFIGURATION_INVALID" },
      { status: 503 }
    );
  }

  try {
    const persisted = await createPersistedMission(parsed.data.request, mode);

    return Response.json(
      {
        ...persisted,
        persisted: true,
        orchestrationMode: mode,
        disclaimer:
          mode === "SIMULATION"
            ? "Mission created in simulation mode. Provider evidence will be clearly mocked."
            : "Live mission created. No external action occurs until authenticated orchestration explicitly advances it."
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { error: "INVALID_MISSION_REQUEST", details: error.flatten() },
        { status: 400 }
      );
    }

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
