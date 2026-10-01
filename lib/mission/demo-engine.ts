import {
  communicationResultSchema,
  missionStepSchema,
  type CommunicationResult,
  type Mission,
  type MissionStatus,
  type MissionStep
} from "../schemas";
import {
  buildTemporaryDemoQuotes,
  selectTemporaryRecommendation,
  temporaryDemoProviders
} from "../demo/temporary-scenario";
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
    message: "Temporary Phase 1 provider fixtures loaded."
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
    message: "Temporary deterministic comparison executed."
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

function buildDemoCommunications(
  mission: Mission,
  quotes: MissionSnapshot["quotes"]
): CommunicationResult[] {
  return quotes.map((quote, index) => {
    const provider = temporaryDemoProviders.find(
      (candidate) => candidate.id === quote.providerId
    );

    return communicationResultSchema.parse({
      id: `${mission.id}-communication-${index + 1}`,
      missionId: mission.id,
      providerId: quote.providerId,
      channel: "MOCK",
      status: "COMPLETED",
      summary: quote.available
        ? `Mock response captured from ${provider?.name ?? "provider"}.`
        : `${provider?.name ?? "Provider"} responded that the request is unavailable.`,
      observation: {
        available: quote.available,
        price: quote.price,
        deliveryFee: quote.deliveryFee,
        deliveryDate: quote.deliveryDate,
        notes: quote.notes
      },
      occurredAt: new Date().toISOString()
    });
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

  const quotes = buildTemporaryDemoQuotes(mission);
  const communications = buildDemoCommunications(mission, quotes);
  const selected = selectTemporaryRecommendation(mission, quotes);
  const selectedProvider = selected
    ? temporaryDemoProviders.find(
        (provider) => provider.id === selected.providerId
      )
    : undefined;

  return {
    mission,
    steps,
    providers: temporaryDemoProviders,
    communications,
    quotes,
    recommendation:
      selected && selectedProvider
        ? {
            providerId: selected.providerId,
            quoteId: selected.id,
            reasons: [
              selected.total !== undefined && mission.budget !== undefined
                ? `₦${selected.total.toLocaleString()} total stays within the ₦${mission.budget.toLocaleString()} budget.`
                : "Qualifying total is available.",
              selected.deliveryDate === mission.deadline
                ? `Can meet the ${mission.deadline} delivery requirement.`
                : "Has a delivery commitment recorded.",
              selectedProvider.verified
                ? "Provider has the demo verified signal."
                : "Provider qualification was based on available demo signals."
            ]
          }
        : undefined,
    demoMode: true
  };
}
