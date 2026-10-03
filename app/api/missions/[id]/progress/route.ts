import { reconcileLiveMission } from "../../../../../lib/mission/live-auto-runner";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const result = await reconcileLiveMission(params.id);
    return Response.json({
      ...result,
      transactionPerformed: false,
      humanApprovalBypassed: false
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "LIVE_RECONCILE_FAILED";

    if (message === "MISSION_NOT_FOUND") {
      return Response.json({ error: message }, { status: 404 });
    }

    console.error("Live mission reconcile failed", error);
    return Response.json(
      {
        error: "LIVE_RECONCILE_FAILED",
        message,
        transactionPerformed: false
      },
      { status: 500 }
    );
  }
}
