import { randomUUID } from "node:crypto";
import { z } from "zod";
import { temporaryDemoProviders } from "../../demo/temporary-scenario";
import {
  getMissionSnapshot,
  saveMissionSnapshot
} from "../neon/mission-snapshot-repository";
import {
  getLiveTestProvider,
  readLiveTestProviders,
  searchLiveTestProviders
} from "../providers/live-test-directory";
import {
  missionStepSchema,
  providerSchema,
  quoteSchema
} from "../../schemas";
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
    const providers = searchLiveTestProviders(parsed);
    if (!providers) {
      throw new Error("LIVE_PROVIDER_DIRECTORY_NOT_CONFIGURED");
    }
    return providers;
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

export function getProviderForAgent(
  providerId: string,
  mode: "SIMULATION" | "LIVE"
) {
  if (mode === "LIVE") {
    if (!readLiveTestProviders()) {
      throw new Error("LIVE_PROVIDER_DIRECTORY_NOT_CONFIGURED");
    }
    return getLiveTestProvider(providerId);
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

function assertQuoteRecordingStage(status: string) {
  if (!["CONTACTING", "COLLECTING_QUOTES", "COMPARING"].includes(status)) {
    throw new Error("MISSION_NOT_READY_FOR_QUOTE_RECORDING");
  }
}

export async function recordQuoteForAgent(
  input: z.infer<typeof recordQuoteToolInputSchema>
) {
  const { quote } = recordQuoteToolInputSchema.parse(input);
  const snapshot = await getMissionSnapshot(quote.missionId);

  if (!snapshot) throw new Error("MISSION_NOT_FOUND");
  assertQuoteRecordingStage(snapshot.mission.status);

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

function normalizeBimpeBoolean(value: unknown) {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return value;
}

function normalizeOptionalBimpeNumber(value: unknown) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return value;

  const normalized = value.trim();
  if (normalized === "") return undefined;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : value;
}

const bimpeBooleanSchema = z.preprocess(normalizeBimpeBoolean, z.boolean());
const optionalPositiveBimpeNumberSchema = z.preprocess(
  normalizeOptionalBimpeNumber,
  z.number().positive().optional()
);
const optionalNonnegativeBimpeNumberSchema = z.preprocess(
  normalizeOptionalBimpeNumber,
  z.number().nonnegative().optional()
);

export const recordProviderResponseToolInputSchema = z.object({
  missionId: z.string().trim().min(1),
  communicationId: z.string().trim().min(1),
  available: bimpeBooleanSchema,
  quantity: optionalPositiveBimpeNumberSchema,
  unit: z.string().trim().min(1).optional(),
  price: optionalNonnegativeBimpeNumberSchema,
  deliveryFee: optionalNonnegativeBimpeNumberSchema,
  total: optionalNonnegativeBimpeNumberSchema,
  deliveryDate: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional()
});

/**
 * Controlled evidence → Quote boundary.
 *
 * The caller supplies already-extracted factual fields. SABI does not parse or
 * invent transcript content here. A Quote is created only when the referenced
 * CommunicationResult is COMPLETED, belongs to the same persisted Mission and
 * provider, and the Mission is at a valid quote-collection stage.
 *
 * Quantity/unit are accepted only as explicit provider evidence. The Mission's
 * requested quantity is never copied into the Quote automatically.
 *
 * Repeating the same extraction is idempotent because the Quote ID is derived
 * from the communication ID.
 */
export async function recordProviderResponseForAgent(
  input: z.infer<typeof recordProviderResponseToolInputSchema>
) {
  const facts = recordProviderResponseToolInputSchema.parse(input);
  const snapshot = await getMissionSnapshot(facts.missionId);

  if (!snapshot) throw new Error("MISSION_NOT_FOUND");
  assertQuoteRecordingStage(snapshot.mission.status);

  const communication = snapshot.communications.find(
    (candidate) => candidate.id === facts.communicationId
  );

  if (!communication) throw new Error("COMMUNICATION_NOT_FOUND");
  if (communication.missionId !== snapshot.mission.id) {
    throw new Error("COMMUNICATION_MISSION_MISMATCH");
  }
  if (communication.status !== "COMPLETED") {
    throw new Error("COMMUNICATION_NOT_COMPLETED");
  }
  if (!snapshot.providers.some((provider) => provider.id === communication.providerId)) {
    throw new Error("COMMUNICATION_PROVIDER_MISMATCH");
  }
  if (!snapshot.demoMode && communication.channel === "MOCK") {
    throw new Error("MOCK_EVIDENCE_NOT_ALLOWED_FOR_LIVE_MISSION");
  }

  const source =
    communication.channel === "CALL"
      ? "CALL"
      : communication.channel === "SMS"
        ? "SMS"
        : "OTHER";

  const quote = quoteSchema.parse({
    id: `quote-${communication.id}`,
    missionId: snapshot.mission.id,
    providerId: communication.providerId,
    available: facts.available,
    quantity: facts.available ? facts.quantity : undefined,
    unit: facts.available ? facts.unit : undefined,
    price: facts.price,
    deliveryFee: facts.deliveryFee,
    total: facts.total,
    deliveryDate: facts.deliveryDate,
    notes: facts.notes,
    source,
    sourceReference: communication.externalId ?? communication.id,
    createdAt: new Date().toISOString()
  });

  const quotes = snapshot.quotes.some((candidate) => candidate.id === quote.id)
    ? snapshot.quotes.map((candidate) =>
        candidate.id === quote.id ? quote : candidate
      )
    : [...snapshot.quotes, quote];

  const communications = snapshot.communications.map((candidate) =>
    candidate.id === communication.id
      ? {
          ...candidate,
          observation: {
            available: facts.available,
            quantity: facts.available ? facts.quantity : undefined,
            unit: facts.available ? facts.unit : undefined,
            price: facts.price,
            deliveryFee: facts.deliveryFee,
            total: facts.total,
            deliveryDate: facts.deliveryDate,
            notes: facts.notes
          }
        }
      : candidate
  );

  const persisted = await saveMissionSnapshot({
    ...snapshot,
    communications,
    quotes
  });

  return { quote, snapshot: persisted };
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
