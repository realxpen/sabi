import { randomUUID } from "node:crypto";
import { z } from "zod";
import { temporaryDemoProviders } from "../../demo/temporary-scenario";
import {
  getMissionSnapshot,
  saveMissionSnapshot
} from "../neon/mission-snapshot-repository";
import { missionStepSchema, providerSchema, quoteSchema } from "../../schemas";
import { runMissionIntelligence } from "../../mission/intelligence-runtime";
import { transitionMission } from "../../mission/state-machine";

export const agentProviderModeSchema = z.enum(["SIMULATION", "LIVE"]);

export const searchProvidersToolInputSchema = z.object({
  mode: agentProviderModeSchema.default("SIMULATION"),
  query: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  location: z.string().trim().min(1).optional(),
  verified: z.boolean().optional(),
  active: z.boolean().optional()
});

export function searchProvidersForAgent(
  input: z.infer<typeof searchProvidersToolInputSchema>
) {
  const parsed = searchProvidersToolInputSchema.parse(input);

  if (parsed.mode === "LIVE") {
    throw new Error("LIVE_PROVIDER_DIRECTORY_NOT_CONFIGURED");
  }

  const query = parsed.query?.toLowerCase();

  return temporaryDemoProviders
    .filter((provider) => {
      if (query) {
        const haystack = [
          provider.name,
          provider.category,
          provider.location,
          ...provider.languages
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      if (
        parsed.category &&
        provider.category.toLowerCase() !== parsed.category.toLowerCase()
      ) {
        return false;
      }

      if (
        parsed.location &&
        provider.location.toLowerCase() !== parsed.location.toLowerCase()
      ) {
        return false;
      }

      if (
        parsed.verified !== undefined &&
        provider.verified !== parsed.verified
      ) {
        return false;
      }

      if (parsed.active !== undefined && provider.active !== parsed.active) {
        return false;
      }

      return true;
    })
    .map((provider) => providerSchema.parse(provider));
}

export function getProviderForAgent(providerId: string, mode: "SIMULATION" | "LIVE") {
  if (mode === "LIVE") {
    throw new Error("LIVE_PROVIDER_DIRECTORY_NOT_CONFIGURED");
  }

  const provider = temporaryDemoProviders.find(
    (candidate) => candidate.id === providerId
  );

  return provider ? providerSchema.parse(provider) : undefined;
}

export const recordQuoteToolInputSchema = z.object({
  quote: quoteSchema.refine((quote) => Boolean(quote.sourceReference), {
    message: "Agent-recorded Quotes require sourceReference evidence."
  })
});

export async function recordQuoteForAgent(
  input: z.infer<typeof recordQuoteToolInputSchema>
) {
  const { quote } = recordQuoteToolInputSchema.parse(input);
  const snapshot = await getMissionSnapshot(quote.missionId);

  if (!snapshot) throw new Error("MISSION_NOT_FOUND");

  if (
    !["CONTACTING", "COLLECTING_QUOTES", "COMPARING"].includes(
      snapshot.mission.status
    )
  ) {
    throw new Error("MISSION_NOT_READY_FOR_QUOTE_RECORDING");
  }

  if (!snapshot.providers.some((provider) => provider.id === quote.providerId)) {
    throw new Error("QUOTE_PROVIDER_MISMATCH");
  }

  const existingIndex = snapshot.quotes.findIndex((item) => item.id === quote.id);
  const quotes =
    existingIndex === -1
      ? [...snapshot.quotes, quote]
      : snapshot.quotes.map((item, index) =>
          index === existingIndex ? quote : item
        );

  return saveMissionSnapshot({ ...snapshot, quotes });
}

export async function compareQuotesForAgent(missionId: string) {
  const snapshot = await getMissionSnapshot(missionId);

  if (!snapshot) throw new Error("MISSION_NOT_FOUND");
  if (snapshot.mission.status !== "COMPARING") {
    throw new Error("MISSION_NOT_READY_FOR_COMPARISON");
  }
  if (snapshot.quotes.length === 0) {
    throw new Error("QUOTES_NOT_READY");
  }

  return runMissionIntelligence(missionId);
}

export async function requestHumanApprovalForAgent(missionId: string) {
  const snapshot = await getMissionSnapshot(missionId);

  if (!snapshot) throw new Error("MISSION_NOT_FOUND");
  if (!snapshot.recommendation) throw new Error("RECOMMENDATION_NOT_READY");

  if (snapshot.mission.status === "AWAITING_APPROVAL") {
    return snapshot;
  }

  if (snapshot.mission.status !== "COMPARING") {
    throw new Error("MISSION_NOT_READY_FOR_APPROVAL_REQUEST");
  }

  const mission = transitionMission(snapshot.mission, "AWAITING_APPROVAL");
  const step = missionStepSchema.parse({
    id: `step-${randomUUID()}`,
    missionId,
    type: "REQUEST_APPROVAL",
    status: "RUNNING",
    message:
      "Recommendation ready. Waiting for explicit human approval; no transaction performed.",
    createdAt: new Date().toISOString()
  });

  return saveMissionSnapshot({
    ...snapshot,
    mission,
    steps: [...snapshot.steps, step]
  });
}
