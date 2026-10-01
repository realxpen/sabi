import type { MissionSnapshot } from "./snapshot";
import { parseDemoMissionRequest } from "./demo-parser";

/**
 * Create the durable starting point for a Mission.
 *
 * No provider search, communication, Quote, recommendation or consequential
 * action happens here. The orchestrator advances this snapshot explicitly.
 */
export function buildInitialMissionSnapshot(
  rawRequest: string,
  id: string,
  demoMode = true
): MissionSnapshot {
  return {
    mission: parseDemoMissionRequest(rawRequest, id),
    steps: [],
    providers: [],
    communications: [],
    quotes: [],
    demoMode
  };
}
