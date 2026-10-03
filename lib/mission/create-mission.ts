import { randomUUID } from "node:crypto";
import { z } from "zod";
import { saveMissionSnapshot } from "../integrations/neon/mission-snapshot-repository";
import { discoverRegisteredProvidersForMission } from "../integrations/neon/provider-registry";
import { discoverLiveTestProvidersForMission } from "../integrations/providers/live-test-directory";
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

function uniqueProviders<T extends { id: string }>(providers: T[]): T[] {
  return [...new Map(providers.map((provider) => [provider.id, provider])).values()];
}

export async function createPersistedMission(
  rawRequest: string,
  mode: MissionExecutionMode
) {
  const request = z.string().trim().min(1).parse(rawRequest);
  const initial = buildInitialMissionSnapshot(
    request,
    `mission-${randomUUID()}`,
    mode === "SIMULATION"
  );

  if (mode === "SIMULATION") {
    return saveMissionSnapshot(initial);
  }

  const configuredProviders =
    discoverLiveTestProvidersForMission(initial.mission) ?? [];
  const registeredProviders = await discoverRegisteredProvidersForMission(
    initial.mission
  );

  return saveMissionSnapshot({
    ...initial,
    providers: uniqueProviders([
      ...configuredProviders,
      ...registeredProviders
    ])
  });
}
