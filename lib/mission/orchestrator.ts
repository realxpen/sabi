import { randomUUID } from "node:crypto";
import {
  communicationResultSchema,
  missionStepSchema,
  type CommunicationResult,
  type MissionStatus,
  type Provider,
  type Quote
} from "../schemas";
import {
  buildTemporaryDemoQuotes,
  temporaryDemoProviders
} from "../demo/temporary-scenario";
import { recommend } from "../intelligence";
import {
  getMissionSnapshot,
  saveMissionSnapshot
} from "../integrations/neon/mission-snapshot-repository";
import { discoverLiveTestProvidersForMission } from "../integrations/providers/live-test-directory";
import type { CommunicationAdapter } from "../integrations/communication/types";
import { quoteFromCommunicationEvidence } from "./quote-evidence";
import type { MissionSnapshot } from "./snapshot";
import { transitionMission } from "./state-machine";

export type MissionOrchestrationMode = "SIMULATION" | "LIVE";

export type MissionOrchestrationOutcome =
  | "ADVANCED"
  | "WAITING"
  | "CHECKPOINT";

export type MissionOrchestrationResult = {
  snapshot: MissionSnapshot;
  outcome: MissionOrchestrationOutcome;
  reason: string;
};

export type MissionOrchestrationDependencies = {
  mode: MissionOrchestrationMode;
  communicationAdapter?: CommunicationAdapter;
};

const TERMINAL_OR_CHECKPOINT = new Set<MissionStatus>([
  "AWAITING_APPROVAL",
  "APPROVED",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "ESCALATED"
]);

function makeStep(
  snapshot: MissionSnapshot,
  type: string,
  message: string,
  status: "RUNNING" | "COMPLETED" | "FAILED" = "COMPLETED"
) {
  return missionStepSchema.parse({
    id: `step-${randomUUID()}`,
    missionId: snapshot.mission.id,
    type,
    status,
    message,
    createdAt: new Date().toISOString()
  });
}

async function persistTransition(
  snapshot: MissionSnapshot,
  to: MissionStatus,
  type: string,
  message: string,
  patch: Partial<Omit<MissionSnapshot, "mission" | "steps">> = {}
): Promise<MissionSnapshot> {
  const mission = transitionMission(snapshot.mission, to);
  const step = makeStep(snapshot, type, message);

  return saveMissionSnapshot({
    ...snapshot,
    ...patch,
    mission,
    steps: [...snapshot.steps, step]
  });
}

function buildSimulationCommunications(
  snapshot: MissionSnapshot,
  providers: Provider[]
): CommunicationResult[] {
  const quotes = buildTemporaryDemoQuotes(snapshot.mission);

  return providers.map((provider) => {
    const quote = quotes.find((candidate) => candidate.providerId === provider.id);

    return communicationResultSchema.parse({
      id: `${snapshot.mission.id}-simulation-${provider.id}`,
      missionId: snapshot.mission.id,
      providerId: provider.id,
      channel: "MOCK",
      status: "COMPLETED",
      summary:
        "Simulation-only provider response. No real provider was contacted.",
      observation: quote
        ? {
            available: quote.available,
            price: quote.price,
            deliveryFee: quote.deliveryFee,
            deliveryDate: quote.deliveryDate,
            notes: quote.notes
          }
        : undefined,
      occurredAt: new Date().toISOString()
    });
  });
}

function replaceQuote(quotes: Quote[], next: Quote): Quote[] {
  const index = quotes.findIndex((quote) => quote.id === next.id);
  if (index === -1) return [...quotes, next];
  return quotes.map((quote, candidateIndex) =>
    candidateIndex === index ? next : quote
  );
}

/**
 * Reconcile only explicit structured CommunicationResult observations into
 * canonical Quotes. Transcript/summary text is never parsed here. A completed
 * call without an explicit observation remains communication evidence only.
 */
function reconcileCommunicationQuotes(snapshot: MissionSnapshot): MissionSnapshot {
  let quotes = snapshot.quotes;

  for (const communication of snapshot.communications) {
    if (
      !snapshot.providers.some(
        (provider) => provider.id === communication.providerId
      )
    ) {
      continue;
    }

    const derived = quoteFromCommunicationEvidence(communication);
    if (!derived) continue;
    quotes = replaceQuote(quotes, derived);
  }

  return { ...snapshot, quotes };
}

async function contactLiveProviders(
  snapshot: MissionSnapshot,
  adapter: CommunicationAdapter | undefined
): Promise<CommunicationResult[]> {
  if (!adapter) {
    throw new Error("LIVE_COMMUNICATION_ADAPTER_REQUIRED");
  }

  const objective = `Confirm availability, factual total cost and delivery timing for: ${snapshot.mission.rawRequest}`;
  const results: CommunicationResult[] = [];

  for (const provider of snapshot.providers) {
    const result = await adapter.initiateContact({
      missionId: snapshot.mission.id,
      providerId: provider.id,
      objective
    });
    results.push(communicationResultSchema.parse(result));
  }

  return results;
}

/**
 * Advance exactly one safe orchestration stage.
 *
 * SIMULATION is explicitly labelled and may use fixture providers/Quotes.
 * LIVE never imports simulation providers or Quotes. It may discover only the
 * separately configured SABI_LIVE_TEST_PROVIDERS_JSON metadata directory and
 * stops when provider discovery, provider responses or validated Quotes are
 * missing.
 */
export async function advanceMissionOrchestration(
  missionId: string,
  dependencies: MissionOrchestrationDependencies
): Promise<MissionOrchestrationResult> {
  const snapshot = await getMissionSnapshot(missionId);

  if (!snapshot) {
    throw new Error("MISSION_NOT_FOUND");
  }

  if (dependencies.mode === "SIMULATION" && !snapshot.demoMode) {
    throw new Error("SIMULATION_NOT_ALLOWED_FOR_LIVE_MISSION");
  }

  if (TERMINAL_OR_CHECKPOINT.has(snapshot.mission.status)) {
    return {
      snapshot,
      outcome: "CHECKPOINT",
      reason: `Mission is at ${snapshot.mission.status}.`
    };
  }

  switch (snapshot.mission.status) {
    case "CREATED": {
      const next = await persistTransition(
        snapshot,
        "UNDERSTANDING",
        "UNDERSTAND_REQUEST",
        "Request accepted for structured mission processing."
      );
      return { snapshot: next, outcome: "ADVANCED", reason: "Request understood." };
    }

    case "UNDERSTANDING": {
      const next = await persistTransition(
        snapshot,
        "PLANNING",
        "PLAN",
        "Plan prepared with explicit human approval required before consequential action."
      );
      return { snapshot: next, outcome: "ADVANCED", reason: "Plan prepared." };
    }

    case "PLANNING": {
      const configuredLiveProviders =
        dependencies.mode === "LIVE" && snapshot.providers.length === 0
          ? discoverLiveTestProvidersForMission(snapshot.mission) ?? []
          : snapshot.providers;

      const providers =
        dependencies.mode === "SIMULATION"
          ? temporaryDemoProviders
          : configuredLiveProviders;

      const next = await persistTransition(
        snapshot,
        "SEARCHING",
        "SEARCH_PROVIDERS",
        dependencies.mode === "SIMULATION"
          ? "Simulation provider fixtures loaded; no live directory was queried."
          : providers.length
            ? "Configured live test-provider metadata matched the Mission and is ready for bounded contact."
            : "Waiting for configured live test-provider metadata before contact.",
        { providers }
      );

      return {
        snapshot: next,
        outcome: providers.length ? "ADVANCED" : "WAITING",
        reason: providers.length
          ? "Provider candidates available."
          : "WAITING_FOR_PROVIDER_DISCOVERY"
      };
    }

    case "SEARCHING": {
      if (snapshot.providers.length === 0) {
        return {
          snapshot,
          outcome: "WAITING",
          reason: "WAITING_FOR_PROVIDER_DISCOVERY"
        };
      }

      const next = await persistTransition(
        snapshot,
        "CONTACTING",
        "CONTACT_PROVIDERS",
        dependencies.mode === "SIMULATION"
          ? "Simulation contact stage started; no real provider will be contacted."
          : "Validated provider contact stage started."
      );
      return { snapshot: next, outcome: "ADVANCED", reason: "Contact stage started." };
    }

    case "CONTACTING": {
      const communications =
        dependencies.mode === "SIMULATION"
          ? buildSimulationCommunications(snapshot, snapshot.providers)
          : await contactLiveProviders(snapshot, dependencies.communicationAdapter);

      const quotes =
        dependencies.mode === "SIMULATION"
          ? buildTemporaryDemoQuotes(snapshot.mission)
          : snapshot.quotes;

      const next = await persistTransition(
        snapshot,
        "COLLECTING_QUOTES",
        "COLLECT_QUOTES",
        dependencies.mode === "SIMULATION"
          ? "Simulation responses captured as explicitly mocked evidence and fixture Quotes."
          : "Provider contact initiated. Waiting for factual responses and validated Quotes.",
        { communications, quotes }
      );

      return {
        snapshot: next,
        outcome: dependencies.mode === "SIMULATION" ? "ADVANCED" : "WAITING",
        reason:
          dependencies.mode === "SIMULATION"
            ? "Simulation evidence collected."
            : "WAITING_FOR_PROVIDER_RESPONSES"
      };
    }

    case "COLLECTING_QUOTES": {
      const reconciled = reconcileCommunicationQuotes(snapshot);

      if (reconciled.quotes.length === 0) {
        if (reconciled !== snapshot) await saveMissionSnapshot(reconciled);
        return {
          snapshot: reconciled,
          outcome: "WAITING",
          reason: "WAITING_FOR_VALIDATED_QUOTES"
        };
      }

      const next = await persistTransition(
        reconciled,
        "COMPARING",
        "COMPARE_QUOTES",
        "Validated source-traceable Quotes are ready for deterministic constraint filtering and ranking."
      );
      return { snapshot: next, outcome: "ADVANCED", reason: "Quotes ready for comparison." };
    }

    case "COMPARING": {
      const intelligence = recommend(
        snapshot.mission,
        snapshot.providers,
        snapshot.quotes
      );

      if (!intelligence.selected) {
        return {
          snapshot,
          outcome: "WAITING",
          reason: "NO_QUALIFYING_QUOTE"
        };
      }

      const recommendation = {
        providerId: intelligence.selected.provider.id,
        quoteId: intelligence.selected.quote.id,
        reasons: [
          intelligence.explanation ??
            "Selected by deterministic hard-constraint filtering and ranking.",
          ...intelligence.recommendationFactors
        ]
      };

      const next = await persistTransition(
        snapshot,
        "AWAITING_APPROVAL",
        "REQUEST_APPROVAL",
        "Recommendation prepared. No purchase, booking or payment will occur without explicit human approval.",
        { recommendation }
      );

      return {
        snapshot: next,
        outcome: "CHECKPOINT",
        reason: "AWAITING_HUMAN_APPROVAL"
      };
    }

    default:
      return {
        snapshot,
        outcome: "CHECKPOINT",
        reason: `No automatic orchestration is defined for ${snapshot.mission.status}.`
      };
  }
}
