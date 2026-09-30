import { randomUUID } from "node:crypto";
import {
  communicationResultSchema,
  missionSchema,
  missionStatusSchema,
  missionStepSchema,
  type CommunicationResult,
  type Mission,
  type MissionStatus,
  type MissionStep,
  type MissionStepStatus
} from "../schemas";
import { transitionMission } from "./state-machine";

export type ApplyCommunicationResultInput = {
  mission: Mission;
  communication: CommunicationResult;
  requestedTransition?: MissionStatus;
};

export type ApplyCommunicationResultResult = {
  mission: Mission;
  step: MissionStep;
};

function missionStepStatusForCommunication(
  communication: CommunicationResult
): MissionStepStatus {
  switch (communication.status) {
    case "INITIATED":
    case "IN_PROGRESS":
      return "RUNNING";
    case "COMPLETED":
      return "COMPLETED";
    case "NO_ANSWER":
    case "UNAVAILABLE":
    case "FAILED":
      return "FAILED";
  }
}

function missionStepMessageForCommunication(
  communication: CommunicationResult
): string {
  switch (communication.status) {
    case "INITIATED":
      return "Provider communication initiated.";
    case "IN_PROGRESS":
      return "Provider communication in progress.";
    case "COMPLETED":
      return "Provider communication completed.";
    case "NO_ANSWER":
      return "Provider communication ended without an answer.";
    case "UNAVAILABLE":
      return "Provider communication was unavailable.";
    case "FAILED":
      return "Provider communication failed.";
  }
}

/**
 * Controlled bridge from a normalized CommunicationResult into Mission state.
 *
 * The communication result never chooses a Mission transition on its own.
 * Callers may request a transition, but it must pass the existing Mission
 * state machine. A failed/no-answer provider therefore records a failed
 * communication step while leaving the Mission itself unchanged by default.
 *
 * MissionStep messages are intentionally metadata-only and never copy partner
 * summaries, observations or transcript text into Mission history.
 */
export function applyCommunicationResultToMission(
  input: ApplyCommunicationResultInput
): ApplyCommunicationResultResult {
  const mission = missionSchema.parse(input.mission);
  const communication = communicationResultSchema.parse(input.communication);
  const requestedTransition = input.requestedTransition
    ? missionStatusSchema.parse(input.requestedTransition)
    : undefined;

  if (communication.missionId !== mission.id) {
    throw new Error("Communication/Mission correlation mismatch");
  }

  const step = missionStepSchema.parse({
    id: `step-${randomUUID()}`,
    missionId: mission.id,
    type: "PROVIDER_COMMUNICATION",
    status: missionStepStatusForCommunication(communication),
    message: missionStepMessageForCommunication(communication),
    createdAt: new Date().toISOString()
  });

  return {
    mission: requestedTransition
      ? transitionMission(mission, requestedTransition)
      : mission,
    step
  };
}
