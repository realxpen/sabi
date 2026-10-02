import type { Mission } from "../schemas";

export type KnowledgeTopic =
  | "APPROVAL"
  | "PROCUREMENT"
  | "TRUST"
  | "COMMUNICATION"
  | "TRUTHFULNESS";

export type KnowledgeLifecycle = "ACTIVE" | "DEPRECATED" | "ARCHIVED";

export type KnowledgeEntry = {
  id: string;
  topic: KnowledgeTopic;
  lifecycle: KnowledgeLifecycle;
  kind: "DURABLE_KNOWLEDGE";
  sourceId: string;
  source: string;
  content: string;
  keywords: string[];
};

const entries: KnowledgeEntry[] = [
  {
    id: "knowledge.approval.active",
    topic: "APPROVAL",
    lifecycle: "ACTIVE",
    kind: "DURABLE_KNOWLEDGE",
    sourceId: "trust-model-human-approval",
    source: "Knowledge/Product/TRUST_MODEL.md",
    keywords: ["approval", "purchase", "budget", "human"],
    content:
      "Consequential actions require explicit human approval. SABI may compare and recommend, but the MVP does not purchase, book, send money, release escrow, exceed a hard budget, or materially alter constraints without approval."
  },
  {
    id: "knowledge.procurement.active",
    topic: "PROCUREMENT",
    lifecycle: "ACTIVE",
    kind: "DURABLE_KNOWLEDGE",
    sourceId: "mvp-scope-procurement-flow",
    source: "Knowledge/Product/MVP_SCOPE.md",
    keywords: ["procurement", "provider", "quote", "deadline", "budget", "item"],
    content:
      "Procurement follows structured mission, provider discovery, provider contact, quote collection, comparison, recommendation, and human approval."
  },
  {
    id: "knowledge.trust.active",
    topic: "TRUST",
    lifecycle: "ACTIVE",
    kind: "DURABLE_KNOWLEDGE",
    sourceId: "trust-model-provider-signals",
    source: "Knowledge/Product/TRUST_MODEL.md",
    keywords: ["trust", "verified", "reliability", "provider"],
    content:
      "Trust can use verification, completed work, ratings, cancellations, disputes, response rate and fulfilment reliability. Demo verification is seeded data and must not be presented as production verification."
  },
  {
    id: "knowledge.communication.active",
    topic: "COMMUNICATION",
    lifecycle: "ACTIVE",
    kind: "DURABLE_KNOWLEDGE",
    sourceId: "integration-contract-transcript-quote-boundary",
    source: "Knowledge/Technical/INTEGRATION_CONTRACTS.md",
    keywords: ["communication", "call", "transcript", "quote", "no-answer", "message"],
    content:
      "Communication initiation is not call completion. A transcript is evidence, not automatically a Quote. No-answer or unavailable communication does not create a fabricated Quote."
  },
  {
    id: "knowledge.truthfulness.active",
    topic: "TRUTHFULNESS",
    lifecycle: "ACTIVE",
    kind: "DURABLE_KNOWLEDGE",
    sourceId: "llm-knowledge-hallucination-freshness",
    source: "Knowledge/Technical/LLM_KNOWLEDGE_ARCHITECTURE.md",
    keywords: ["unknown", "truth", "price", "availability", "delivery", "provenance", "quantity"],
    content:
      "Unknown values stay unknown. Live price, availability, delivery promises and call outcomes belong to operational/tool data, not durable Knowledge. Quote fields remain source-traceable."
  }
];

function defaultTopics(mission: Mission): Set<KnowledgeTopic> {
  const topics = new Set<KnowledgeTopic>(["APPROVAL", "TRUTHFULNESS"]);
  if (mission.type === "PROCUREMENT") topics.add("PROCUREMENT");
  return topics;
}

export function retrieveKnowledge(
  mission: Mission,
  requestedTopics?: KnowledgeTopic[]
): KnowledgeEntry[] {
  const topics = requestedTopics
    ? new Set<KnowledgeTopic>(requestedTopics)
    : defaultTopics(mission);
  const query = `${mission.type} ${mission.item} ${mission.rawRequest} ${mission.deadline ?? ""}`.toLowerCase();

  return entries
    .filter((entry) => entry.lifecycle === "ACTIVE" && topics.has(entry.topic))
    .map((entry) => ({
      entry,
      score: entry.keywords.reduce(
        (sum, keyword) => sum + (query.includes(keyword) ? 1 : 0),
        0
      )
    }))
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id))
    .map(({ entry }) => entry);
}
