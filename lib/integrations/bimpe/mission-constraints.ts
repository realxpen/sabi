import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  getMissionSnapshot,
  saveMissionSnapshot
} from "../neon/mission-snapshot-repository";
import { missionStepSchema } from "../../schemas";
import type { MissionSnapshot } from "../../mission/snapshot";

const normalizedNumber = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : value;
}, z.number().finite().nonnegative());

const normalizedTrue = z.preprocess((value) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.literal(true));

export const updateMissionConstraintsToolInputSchema = z.object({
  missionId: z.string().trim().min(1),
  budget: normalizedNumber,
  humanConfirmed: normalizedTrue
});

export type UpdateMissionConstraintsToolInput = z.infer<
  typeof updateMissionConstraintsToolInputSchema
>;

export type MissionBudgetUpdateResult = {
  snapshot: MissionSnapshot;
  previousBudget: number | undefined;
  budget: number;
  changed: boolean;
};

export function applyHumanConfirmedBudgetUpdate(
  snapshot: MissionSnapshot,
  input: UpdateMissionConstraintsToolInput
): MissionBudgetUpdateResult {
  if (snapshot.mission.status !== "COMPARING") {
    throw new Error("MISSION_NOT_READY_FOR_CONSTRAINT_UPDATE");
  }

  const previousBudget = snapshot.mission.budget;
  const recommendationPresent = snapshot.recommendation !== undefined;
  const changed = previousBudget !== input.budget || recommendationPresent;

  if (!changed) {
    return {
      snapshot,
      previousBudget,
      budget: input.budget,
      changed: false
    };
  }

  const step = missionStepSchema.parse({
    id: `step-${randomUUID()}`,
    missionId: snapshot.mission.id,
    type: "UPDATE_CONSTRAINTS",
    status: "COMPLETED",
    message: `Human-confirmed hard budget updated from ${previousBudget === undefined ? "unset" : `₦${previousBudget.toLocaleString()}`} to ₦${input.budget.toLocaleString()}. Existing provider and Quote evidence was preserved; any prior recommendation was cleared for re-comparison.`,
    createdAt: new Date().toISOString()
  });

  const updated: MissionSnapshot = {
    ...snapshot,
    mission: {
      ...snapshot.mission,
      budget: input.budget
    },
    steps: [...snapshot.steps, step],
    recommendation: undefined
  };

  return {
    snapshot: updated,
    previousBudget,
    budget: input.budget,
    changed: true
  };
}

export async function updateMissionConstraintsForAgent(
  input: UpdateMissionConstraintsToolInput
): Promise<MissionBudgetUpdateResult> {
  const current = await getMissionSnapshot(input.missionId);

  if (!current) {
    throw new Error("MISSION_NOT_FOUND");
  }

  const result = applyHumanConfirmedBudgetUpdate(current, input);
  if (!result.changed) return result;

  return {
    ...result,
    snapshot: await saveMissionSnapshot(result.snapshot)
  };
}
