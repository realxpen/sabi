import { getMissionSnapshot } from "../../../../lib/integrations/neon/mission-snapshot-repository";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: { id: string } }
) {
  try {
    const snapshot = await getMissionSnapshot(context.params.id);

    if (!snapshot) {
      return Response.json(
        { error: "MISSION_NOT_FOUND" },
        { status: 404 }
      );
    }

    return Response.json({
      ...snapshot,
      persisted: true
    });
  } catch (error) {
    console.error("Failed to load mission snapshot", error);

    return Response.json(
      {
        error: "MISSION_PERSISTENCE_UNAVAILABLE"
      },
      { status: 503 }
    );
  }
}
