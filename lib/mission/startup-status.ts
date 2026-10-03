import type { MissionSnapshot } from "./snapshot";

export const BIMPE_HANDOFF_STEP = "BIMPE_HANDOFF";
export const STARTUP_STALL_MS = 90_000;

export type MissionStartupIssue = {
  code: "AGENT_NOT_CONFIGURED" | "AGENT_HANDOFF_FAILED" | "AGENT_START_DELAYED";
  title: string;
  message: string;
};

/** Read-only status. A delayed handoff may still complete; never retry it here. */
export function getMissionStartupIssue(
  snapshot: MissionSnapshot,
  agentConfigured: boolean,
  now = Date.now()
): MissionStartupIssue | null {
  if (snapshot.demoMode || snapshot.mission.status !== "CREATED") return null;

  if (!agentConfigured) {
    return {
      code: "AGENT_NOT_CONFIGURED",
      title: "Live agent connection needs setup",
      message: "Your request is saved, but SABI’s live agent connection is not configured. An administrator needs to connect it before this mission can start."
    };
  }

  const handoff = [...snapshot.steps].reverse().find((step) => step.type === BIMPE_HANDOFF_STEP);
  if (handoff?.status === "FAILED") {
    return {
      code: "AGENT_HANDOFF_FAILED",
      title: "Unable to start your mission",
      message: "Your request is saved, but SABI could not confirm the connection to its live agent. The connection needs to be checked before retrying."
    };
  }

  if (now - Date.parse(snapshot.mission.createdAt) >= STARTUP_STALL_MS) {
    return {
      code: "AGENT_START_DELAYED",
      title: "Your mission has not started yet",
      message: "SABI has not recorded any workflow progress. Keep this mission open while the agent connection is checked; submitting again could start a second attempt."
    };
  }

  return null;
}
