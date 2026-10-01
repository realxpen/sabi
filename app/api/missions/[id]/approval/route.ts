import { z } from "zod";
import {
  getMissionSnapshot,
  saveMissionSnapshot
} from "../../../../../lib/integrations/neon/mission-snapshot-repository";
import { transitionMission } from "../../../../../lib/mission/state-machine";
import { approvalSchema } from "../../../../../lib/schemas";

const approvalRequestSchema = z.object({
  providerId: z.string().min(1),
  quoteId: z.string().min(1)
});

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  const body = await request.json().catch(() => null);
  const parsed = approvalRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: "INVALID_APPROVAL_REQUEST",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  try {
    const snapshot = await getMissionSnapshot(context.params.id);

    if (!snapshot) {
      return Response.json({ error: "MISSION_NOT_FOUND" }, { status: 404 });
    }

    const quote = snapshot.quotes.find(
      (candidate) => candidate.id === parsed.data.quoteId
    );
    const provider = snapshot.providers.find(
      (candidate) => candidate.id === parsed.data.providerId
    );

    if (!quote || !provider || quote.providerId !== provider.id) {
      return Response.json(
        { error: "APPROVAL_REFERENCE_MISMATCH" },
        { status: 409 }
      );
    }

    if (
      snapshot.recommendation &&
      (snapshot.recommendation.quoteId !== quote.id ||
        snapshot.recommendation.providerId !== provider.id)
    ) {
      return Response.json(
        { error: "APPROVAL_DOES_NOT_MATCH_RECOMMENDATION" },
        { status: 409 }
      );
    }

    const approval = approvalSchema.parse({
      id: `${context.params.id}-approval`,
      missionId: context.params.id,
      action: "SELECT_PROVIDER",
      providerId: provider.id,
      quoteId: quote.id,
      status: "APPROVED",
      createdAt: new Date().toISOString()
    });

    const updatedSnapshot = {
      ...snapshot,
      mission: transitionMission(snapshot.mission, "APPROVED")
    };

    await saveMissionSnapshot(updatedSnapshot);

    return Response.json({
      approval,
      missionStatus: updatedSnapshot.mission.status,
      persisted: true,
      transactionPerformed: false,
      message:
        "Human approval was persisted. No purchase, booking, transfer, or payment was performed."
    });
  } catch (error) {
    console.error("Failed to persist mission approval", error);

    return Response.json(
      { error: "MISSION_APPROVAL_UNAVAILABLE" },
      { status: 503 }
    );
  }
}
