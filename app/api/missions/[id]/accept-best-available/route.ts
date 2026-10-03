import { z } from "zod";
import { getMissionSnapshot } from "../../../../../lib/integrations/neon/mission-snapshot-repository";
import { updateMissionConstraintsForAgent } from "../../../../../lib/integrations/bimpe/mission-constraints";
import {
  compareQuotesForAgent,
  requestHumanApprovalForAgent
} from "../../../../../lib/integrations/bimpe/tools";

export const runtime = "nodejs";

const requestSchema = z.object({
  quoteId: z.string().trim().min(1),
  confirmation: z.literal("ACCEPT_OVER_BUDGET")
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "INVALID_BEST_AVAILABLE_DECISION", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const snapshot = await getMissionSnapshot(params.id);
  if (!snapshot) {
    return Response.json({ error: "MISSION_NOT_FOUND" }, { status: 404 });
  }

  if (snapshot.mission.status !== "COMPARING" || snapshot.recommendation) {
    return Response.json(
      { error: "MISSION_NOT_READY_FOR_BEST_AVAILABLE_DECISION" },
      { status: 409 }
    );
  }

  const quote = snapshot.quotes.find((candidate) => candidate.id === parsed.data.quoteId);
  if (!quote || quote.total === undefined || !quote.available) {
    return Response.json(
      { error: "BEST_AVAILABLE_QUOTE_NOT_USABLE" },
      { status: 409 }
    );
  }

  const latestForProvider = snapshot.quotes
    .filter((candidate) => candidate.providerId === quote.providerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  if (!latestForProvider || latestForProvider.id !== quote.id) {
    return Response.json(
      { error: "BEST_AVAILABLE_QUOTE_IS_STALE" },
      { status: 409 }
    );
  }

  const currentBudget = snapshot.mission.budget;
  if (currentBudget !== undefined && quote.total <= currentBudget) {
    return Response.json(
      { error: "QUOTE_ALREADY_WITHIN_BUDGET" },
      { status: 409 }
    );
  }

  try {
    const budgetUpdate = await updateMissionConstraintsForAgent({
      missionId: params.id,
      budget: quote.total,
      humanConfirmed: true
    });

    const comparison = await compareQuotesForAgent(params.id);
    if (
      comparison.intelligence.decisionStatus !== "READY" ||
      !comparison.intelligence.selected
    ) {
      return Response.json(
        {
          error: "BEST_AVAILABLE_STILL_DOES_NOT_QUALIFY",
          decisionStatus: comparison.intelligence.decisionStatus,
          requiredFacts: comparison.intelligence.requiredFacts
        },
        { status: 409 }
      );
    }

    const approvalSnapshot = await requestHumanApprovalForAgent(params.id);

    return Response.json({
      missionId: params.id,
      status: approvalSnapshot.mission.status,
      previousBudget: budgetUpdate.previousBudget,
      budget: budgetUpdate.budget,
      selectedProviderId: comparison.intelligence.selected.provider.id,
      selectedQuoteId: comparison.intelligence.selected.quote.id,
      selectedTotal: comparison.intelligence.selected.quote.total,
      humanConfirmedBudgetOverride: true,
      transactionPerformed: false,
      bookingPerformed: false
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "BEST_AVAILABLE_DECISION_FAILED";
    return Response.json(
      { error: "BEST_AVAILABLE_DECISION_FAILED", message },
      { status: 500 }
    );
  }
}
