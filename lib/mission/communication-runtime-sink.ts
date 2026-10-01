import type { CommunicationResult } from "../schemas";
import { getMissionSnapshot } from "../integrations/neon/mission-snapshot-repository";
import { applyCommunicationResultToMission } from "./communication-bridge";
import { recordCommunicationInMission } from "./persisted-integration";

/**
 * Persist one already-normalized provider communication into Mission Control.
 *
 * This is the only bridge the live webhook runtime needs to know about. It
 * creates a metadata-only MissionStep and stores the CommunicationResult. It
 * never creates a Quote, never infers price/availability from a transcript,
 * and never advances the Mission state on its own.
 */
export async function persistCommunicationResultToMission(
  communication: CommunicationResult
) {
  const snapshot = await getMissionSnapshot(communication.missionId);

  if (!snapshot) {
    throw new Error("MISSION_NOT_FOUND");
  }

  const { step } = applyCommunicationResultToMission({
    mission: snapshot.mission,
    communication
  });

  return recordCommunicationInMission({
    missionId: communication.missionId,
    communication,
    step
  });
}
