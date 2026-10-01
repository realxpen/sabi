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

const demoSteps: StepDefinition[] = [
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
  },
  {
    status: "AWAITING_APPROVAL",
    type: "REQUEST_APPROVAL",
    message: "Recommendation ready. Waiting for human approval."
  }
];

function makeStep(
  mission: Mission,
  definition: StepDefinition,
  index: number,
  isLast: boolean
): MissionStep {
  return missionStepSchema.parse({
    id: `${mission.id}-step-${index + 1}`,
    missionId: mission.id,
    type: definition.type,
    status: isLast ? "RUNNING" : "COMPLETED",
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

  demoSteps.forEach((definition, index) => {
    mission = transitionMission(mission, definition.status);
    steps.push(
      makeStep(
        mission,
        definition,
        index,
        index === demoSteps.length - 1
      )
    );
  });

  const quotes = buildIntelligenceDemoQuotes(mission);
  const result = recommend(mission, intelligenceDemoProviders, quotes);
  const selected = result.selected;

  return {
    mission,
    steps,
    providers: intelligenceDemoProviders,
    quotes,
    recommendation: selected
      ? {
          providerId: selected.provider.id,
          quoteId: selected.quote.id,
          reasons: result.recommendationFactors
        }
      : undefined,
    demoMode: true
  };
}
