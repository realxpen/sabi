import {
  approvalSchema,
  type Approval
} from "../schemas";
import type { MissionSnapshot } from "../mission/snapshot";
import { transitionMission } from "../mission/state-machine";

export type DemoApprovalResult = {
  approval: Approval;
  mission: MissionSnapshot["mission"];
  transactionPerformed: false;
};

export function approveDemoRecommendation(
  snapshot: MissionSnapshot
): DemoApprovalResult {
  if (snapshot.mission.status !== "AWAITING_APPROVAL") {
    throw new Error("Mission is not awaiting approval.");
  }

  if (!snapshot.recommendation) {
    throw new Error("No recommendation is available to approve.");
  }

  const approvedMission = transitionMission(
    snapshot.mission,
    "APPROVED"
  );

  return {
    approval: approvalSchema.parse({
      id: `${snapshot.mission.id}-approval`,
      missionId: snapshot.mission.id,
      action: "SELECT_PROVIDER",
      providerId: snapshot.recommendation.providerId,
      quoteId: snapshot.recommendation.quoteId,
      status: "APPROVED",
      createdAt: new Date().toISOString()
    }),
    mission: approvedMission,
    transactionPerformed: false
  };
}
