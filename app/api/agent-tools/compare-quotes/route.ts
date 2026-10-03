import { randomUUID } from "node:crypto";
import { ZodError, z } from "zod";
import { authorizeAgentToolRequest } from "../../../../lib/integrations/bimpe/agent-tool-auth";
import {
  getMissionSnapshot,
  saveMissionSnapshot
} from "../../../../lib/integrations/neon/mission-snapshot-repository";
import { normalizeRelativeDeadline } from "../../../../lib/intelligence/deadline-normalization";
import { runMissionIntelligence } from "../../../../lib/mission/intelligence-runtime";
import { transitionMission } from "../../../../lib/mission/state-machine";
import { missionStepSchema } from "../../../../lib/schemas";

export const runtime = "nodejs";

const inputSchema = z.object({
  missionId: z.string().trim().min(1)
});

export async function POST(request: Request): Promise<Response> {
  const authFailure = authorizeAgentToolRequest(request);
  if (authFailure) return authFailure;

  const body = await request.json().catch(() => ({}));

  try {
    const { missionId } = inputSchema.parse(body);
    const loadedSnapshot = await getMissionSnapshot(missionId);

    if (!loadedSnapshot) {
      return Response.json({ error: "MISSION_NOT_FOUND" }, { status: 404 });
    }

    let snapshot = loadedSnapshot;

    const normalizedDeadline = normalizeRelativeDeadline(
      snapshot.mission.deadline,
      snapshot.mission.createdAt
    );
    const deadlineNormalized =
      normalizedDeadline !== undefined &&
      normalizedDeadline !== snapshot.mission.deadline;

    if (deadlineNormalized) {
      snapshot = await saveMissionSnapshot({
        ...snapshot,
        mission: {
          ...snapshot.mission,
          deadline: normalizedDeadline
        }
      });
    }

    let advancedToComparing = false;

    if (snapshot.mission.status === "COLLECTING_QUOTES") {
      const hasActiveCommunication = snapshot.communications.some(
        (communication) =>
          communication.status === "INITIATED" ||
          communication.status === "IN_PROGRESS"
      );

      if (hasActiveCommunication) {
        return Response.json(
          { error: "WAITING_FOR_PROVIDER_RESPONSES" },
          { status: 409 }
        );
      }

      if (snapshot.quotes.length === 0) {
        return Response.json({ error: "QUOTES_NOT_READY" }, { status: 409 });
      }

      const allProvidersHaveValidatedQuotes =
        snapshot.providers.length > 0 &&
        snapshot.providers.every((provider) =>
          snapshot.quotes.some((quote) => quote.providerId === provider.id)
        );

      if (!allProvidersHaveValidatedQuotes) {
        return Response.json(
          { error: "WAITING_FOR_VALIDATED_QUOTES" },
          { status: 409 }
        );
      }

      const mission = transitionMission(snapshot.mission, "COMPARING");
      const step = missionStepSchema.parse({
        id: `step-${randomUUID()}`,
        missionId,
        type: "COMPARE_QUOTES",
        status: "COMPLETED",
        message:
          "All provider communications are settled and each provider has a validated source-traceable Quote. Mission advanced to deterministic comparison without additional provider contact.",
        createdAt: new Date().toISOString()
      });

      snapshot = await saveMissionSnapshot({
        ...snapshot,
        mission,
        steps: [...snapshot.steps, step]
      });
      advancedToComparing = true;
    } else if (snapshot.mission.status !== "COMPARING") {
      return Response.json(
        {
          error: "MISSION_NOT_READY_FOR_COMPARISON",
          missionStatus: snapshot.mission.status
        },
        { status: 409 }
      );
    }

    const result = await runMissionIntelligence(missionId);

    return Response.json({
      tool: "compareQuotes",
      data: result.intelligence,
      recommendation: result.snapshot.recommendation,
      meta: {
        persisted: true,
        advancedToComparing,
        deadlineNormalized,
        normalizedDeadline: deadlineNormalized ? normalizedDeadline : undefined,
        communicationInitiated: false,
        quoteCreated: false,
        transactionPerformed: false
      }
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { error: "INVALID_AGENT_TOOL_INPUT", details: error.flatten() },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "COMPARE_QUOTES_FAILED";
    if (message === "MISSION_NOT_FOUND") {
      return Response.json({ error: message }, { status: 404 });
    }

    return Response.json(
      { error: "COMPARE_QUOTES_FAILED", message },
      { status: 500 }
    );
  }
}
