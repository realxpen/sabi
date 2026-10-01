import {
  missionStepSchema,
  type Mission,
  type MissionStatus,
  type MissionStep
} from "../schemas";
import {
  buildIntelligenceDemoQuotes,
  intelligenceDemoProviders,
  recommend
} from "../intelligence";
import { parseDemoMissionRequest } from "./demo-parser";
import { transitionMission } from "./state-machine";
import type { MissionSnapshot } from "./snapshot";

type StepDefinition = {
  status: MissionStatus;
  type: string;
  message: string;
};

const comparisonSteps: StepDefinition[] = [
  {
    status: "UNDERSTANDING",
    type: "UNDERSTAND_REQUEST",
    message: "Request parsed into a structured mission."
  },
  {
    status: "PLANNING",
    type: "PLAN",
    message: "Demo plan prepared with human approval required."
  },
  {
    status: "SEARCHING",
    type: "SEARCH_PROVIDERS",
    message: "Fictional provider fixtures loaded for the intelligence demo."
  },
  {
    status: "CONTACTING",
    type: "CONTACT_PROVIDERS",
    message: "Mock communication path selected; no real provider contacted."
  },
  {
    status: "COLLECTING_QUOTES",
    type: "COLLECT_QUOTES",
    message: "Mock responses normalized into Quote objects."
  },
  {
    status: "COMPARING",
    type: "COMPARE_QUOTES",
    message: "Hard constraints applied before deterministic soft ranking."
  }
];

function makeStep(
  mission: Mission,
  definition: StepDefinition,
  index: number,
  status: MissionStep["status"] = "COMPLETED"
): MissionStep {
  return missionStepSchema.parse({
    id: `${mission.id}-step-${index + 1}`,
    missionId: mission.id,
    type: definition.type,
    status,
    message: definition.message,
    createdAt: new Date().toISOString()
  });
}

export function buildDemoMissionSnapshot(
  rawRequest: string,
  id = "demo-mission"
): MissionSnapshot {
  let mission = parseDemoMissionRequest(rawRequest, id);
  const steps: MissionStep[] = [];

  comparisonSteps.forEach((definition, index) => {
    mission = transitionMission(mission, definition.status);
    steps.push(makeStep(mission, definition, index));
  });

  const quotes = buildIntelligenceDemoQuotes(mission);
  const result = recommend(mission, intelligenceDemoProviders, quotes);

  if (result.decisionStatus === "READY" && result.selected) {
    mission = transitionMission(mission, "AWAITING_APPROVAL");
    steps.push(
      makeStep(
        mission,
        {
          status: "AWAITING_APPROVAL",
          type: "REQUEST_APPROVAL",
          message: "Recommendation ready. Waiting for human approval."
        },
        steps.length,
        "RUNNING"
      )
    );
  } else {
    const last = steps.at(-1);
    if (last) {
      steps[steps.length - 1] = missionStepSchema.parse({
        ...last,
        status: "RUNNING",
        message:
          result.decisionStatus === "BLOCKED_UNKNOWN"
            ? `Comparison is blocked until missing hard-constraint facts are verified: ${result.requiredFacts.join(" | ")}`
            : "Comparison found no valid option under the represented hard constraints."
      });
    }
  }

  return {
    mission,
    steps,
    providers: intelligenceDemoProviders,
    quotes,
    recommendation:
      result.decisionStatus === "READY" && result.selected
        ? {
            providerId: result.selected.provider.id,
            quoteId: result.selected.quote.id,
            reasons: result.recommendationFactors
          }
        : undefined,
    demoMode: true
  };
}
