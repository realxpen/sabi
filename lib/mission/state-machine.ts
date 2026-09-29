import type { Mission, MissionStatus } from "../schemas";

const allowedTransitions: Record<MissionStatus, readonly MissionStatus[]> = {
  CREATED: ["UNDERSTANDING", "CANCELLED", "FAILED"],
  UNDERSTANDING: ["PLANNING", "CANCELLED", "FAILED", "ESCALATED"],
  PLANNING: ["SEARCHING", "CANCELLED", "FAILED", "ESCALATED"],
  SEARCHING: ["CONTACTING", "CANCELLED", "FAILED", "ESCALATED"],
  CONTACTING: [
    "COLLECTING_QUOTES",
    "CANCELLED",
    "FAILED",
    "ESCALATED"
  ],
  COLLECTING_QUOTES: ["COMPARING", "CANCELLED", "FAILED", "ESCALATED"],
  COMPARING: ["AWAITING_APPROVAL", "CANCELLED", "FAILED", "ESCALATED"],
  AWAITING_APPROVAL: ["APPROVED", "CANCELLED", "ESCALATED"],
  APPROVED: ["COMPLETED", "CANCELLED", "FAILED"],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
  ESCALATED: []
};

export class MissionTransitionError extends Error {
  constructor(from: MissionStatus, to: MissionStatus) {
    super(`Invalid mission transition: ${from} -> ${to}`);
    this.name = "MissionTransitionError";
  }
}

export function canTransition(
  from: MissionStatus,
  to: MissionStatus
): boolean {
  return allowedTransitions[from].includes(to);
}

export function transitionMission(
  mission: Mission,
  to: MissionStatus
): Mission {
  if (!canTransition(mission.status, to)) {
    throw new MissionTransitionError(mission.status, to);
  }

  return {
    ...mission,
    status: to
  };
}

export function getAllowedTransitions(
  from: MissionStatus
): readonly MissionStatus[] {
  return allowedTransitions[from];
}
