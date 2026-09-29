import { randomUUID } from "crypto";
import { z } from "zod";
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

  return Response.json(
    {
      ...snapshot,
      disclaimer:
        "Phase 1 mock mode. No real provider contact or transaction occurred."
    },
    { status: 201 }
  );
}
