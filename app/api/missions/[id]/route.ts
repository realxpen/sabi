import { getMissionSnapshot } from "../../../../lib/integrations/neon/mission-snapshot-repository";
import { isBimpeMissionOrchestrationConfigured, missingBimpeMissionConfiguration } from "../../../../lib/integrations/bimpe/conversation-orchestrator";
import { getMissionStartupIssue } from "../../../../lib/mission/startup-status";

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
      startupIssue: getMissionStartupIssue(snapshot, isBimpeMissionOrchestrationConfigured()),
      agentConfiguration: { missing: snapshot.demoMode ? [] : missingBimpeMissionConfiguration() },
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
