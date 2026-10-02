import {
  communicationResultSchema,
  missionStepSchema,
  providerSchema,
  quoteSchema,
  type CommunicationResult,
  type MissionStep,
  type Provider,
  type Quote
} from "../schemas";
import {
  getMissionSnapshot,
  saveMissionSnapshot
} from "../integrations/neon/mission-snapshot-repository";
import {
  missionRecommendationSchema,
  type MissionRecommendation,
  type MissionSnapshot
} from "./snapshot";
import { buildIntegratedMissionSnapshot } from "./integration-snapshot";

export type RecordCommunicationInput = {
  missionId: string;
  communication: CommunicationResult;
  step?: MissionStep;
};

export type RecordIntelligenceInput = {
  missionId: string;
  providers: Provider[];
  quotes: Quote[];
  recommendation?: MissionRecommendation;
};

function replaceById<T extends { id: string }>(items: T[], next: T): T[] {
  const existingIndex = items.findIndex((item) => item.id === next.id);

  if (existingIndex === -1) return [...items, next];

  return items.map((item, index) => (index === existingIndex ? next : item));
}

async function requireMissionSnapshot(missionId: string): Promise<MissionSnapshot> {
  const snapshot = await getMissionSnapshot(missionId);

  if (!snapshot) {
    throw new Error("MISSION_NOT_FOUND");
  }

  return snapshot;
}

/**
 * Xpen integration seam for Lara's normalized communication output.
 *
 * This function stores communication evidence only. It deliberately does not
 * create a Quote from a transcript/summary and it does not choose a Mission
 * transition. Lara's communication bridge may supply a canonical MissionStep.
 */
export async function recordCommunicationInMission({
  missionId,
  communication,
  step
}: RecordCommunicationInput): Promise<MissionSnapshot> {
  const snapshot = await requireMissionSnapshot(missionId);
  const validatedCommunication = communicationResultSchema.parse(communication);
  const validatedStep = step ? missionStepSchema.parse(step) : undefined;

  if (validatedCommunication.missionId !== missionId) {
    throw new Error("COMMUNICATION_MISSION_MISMATCH");
  }

  if (
    !snapshot.providers.some(
      (provider) => provider.id === validatedCommunication.providerId
    )
  ) {
    throw new Error("COMMUNICATION_PROVIDER_MISMATCH");
  }

  if (validatedStep && validatedStep.missionId !== missionId) {
    throw new Error("MISSION_STEP_MISMATCH");
  }

  const updated: MissionSnapshot = {
    ...snapshot,
    communications: replaceById(
      snapshot.communications,
      validatedCommunication
    ),
    steps: validatedStep
      ? replaceById(snapshot.steps, validatedStep)
      : snapshot.steps
  };

  return saveMissionSnapshot(updated);
}

/**
 * Xpen integration seam for Femi's validated intelligence output.
 *
 * Providers, Quotes and the recommendation are validated as one coherent set.
 * This function does not invent missing quote fields and does not advance the
 * Mission state; Femi/Xpen orchestration must use the canonical state machine.
 */
export async function recordIntelligenceInMission({
  missionId,
  providers,
  quotes,
  recommendation
}: RecordIntelligenceInput): Promise<MissionSnapshot> {
  const snapshot = await requireMissionSnapshot(missionId);
  const validatedProviders = providers.map((provider) => providerSchema.parse(provider));
  const validatedQuotes = quotes.map((quote) => quoteSchema.parse(quote));
  const validatedRecommendation = recommendation
    ? missionRecommendationSchema.parse(recommendation)
    : undefined;

  const updated = buildIntegratedMissionSnapshot({
    mission: snapshot.mission,
    steps: snapshot.steps,
    providers: validatedProviders,
    communications: snapshot.communications,
    quotes: validatedQuotes,
    recommendation: validatedRecommendation
  });

  return saveMissionSnapshot(updated);
}
