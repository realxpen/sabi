import { randomUUID } from "node:crypto";
import { z } from "zod";
import { saveMissionSnapshot } from "../integrations/neon/mission-snapshot-repository";
import { buildInitialMissionSnapshot } from "./initial-snapshot";

export const missionExecutionModeSchema = z.enum(["SIMULATION", "LIVE"]);
export type MissionExecutionMode = z.infer<typeof missionExecutionModeSchema>;

export type MissionCreationEnvironment = {
  [key: string]: string | undefined;
};

export function readDefaultMissionExecutionMode(
  environment: MissionCreationEnvironment = process.env
): MissionExecutionMode {
  const raw = environment.SABI_DEFAULT_MISSION_MODE?.trim() || "SIMULATION";
  return missionExecutionModeSchema.parse(raw);
}

export async function createPersistedMission(
  rawRequest: string,
  mode: MissionExecutionMode
) {
  const request = z.string().trim().min(1).parse(rawRequest);
  const snapshot = buildInitialMissionSnapshot(
    request,
    `mission-${randomUUID()}`,
    mode === "SIMULATION"
  );

  return saveMissionSnapshot(snapshot);
}
