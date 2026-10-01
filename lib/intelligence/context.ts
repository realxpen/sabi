import type {
  CommunicationResult,
  Mission,
  Provider,
  Quote
} from "../schemas";
import { retrieveKnowledge, type KnowledgeTopic } from "./knowledge";

export type UserMemoryEntry = {
  id: string;
  source: "EXPLICIT" | "HISTORY";
  content: string;
};

export type MissionIntelligenceContext = {
  currentRequest: string;
  mission: Mission;
  durableKnowledge: ReturnType<typeof retrieveKnowledge>;
  operationalData: {
    providers: Provider[];
    quotes: Quote[];
  };
  userMemory: UserMemoryEntry[];
  communicationObservations: CommunicationResult[];
  approvalState: {
    required: boolean;
  };
  provenance: {
    knowledgeSources: Array<{
      knowledgeId: string;
      sourceId: string;
      source: string;
    }>;
    quoteSources: Array<{
      quoteId: string;
      providerId: string;
      source: Quote["source"];
      sourceReference?: string;
    }>;
    communicationSources: Array<{
      communicationId: string;
      providerId: string;
      channel: CommunicationResult["channel"];
      externalId?: string;
    }>;
  };

  // Compatibility aliases for current consumers. Prefer the explicit lanes above.
  knowledge: ReturnType<typeof retrieveKnowledge>;
  providers: Provider[];
  quotes: Quote[];
};

export type AssembleMissionContextOptions = {
  topics?: KnowledgeTopic[];
  userMemory?: UserMemoryEntry[];
  communicationObservations?: CommunicationResult[];
};

export function assembleMissionContext(
  mission: Mission,
  providers: Provider[],
  quotes: Quote[],
  optionsOrTopics: AssembleMissionContextOptions | KnowledgeTopic[] = {}
): MissionIntelligenceContext {
  const options: AssembleMissionContextOptions = Array.isArray(optionsOrTopics)
    ? { topics: optionsOrTopics }
    : optionsOrTopics;

  const durableKnowledge = retrieveKnowledge(mission, options.topics);
  const userMemory = options.userMemory ?? [];
  const communicationObservations = options.communicationObservations ?? [];

  return {
    currentRequest: mission.rawRequest,
    mission,
    durableKnowledge,
    operationalData: { providers, quotes },
    userMemory,
    communicationObservations,
    approvalState: { required: mission.approvalRequired },
    provenance: {
      knowledgeSources: durableKnowledge.map((entry) => ({
        knowledgeId: entry.id,
        sourceId: entry.sourceId,
        source: entry.source
      })),
      quoteSources: quotes.map((quote) => ({
        quoteId: quote.id,
        providerId: quote.providerId,
        source: quote.source,
        sourceReference: quote.sourceReference
      })),
      communicationSources: communicationObservations.map((result) => ({
        communicationId: result.id,
        providerId: result.providerId,
        channel: result.channel,
        externalId: result.externalId
      }))
    },
    knowledge: durableKnowledge,
    providers,
    quotes
  };
}
