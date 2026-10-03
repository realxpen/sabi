import type { Mission, Provider, Quote } from "../schemas";
import {
  evaluateCandidates,
  type ExclusionReason,
  type UncertaintyReason
} from "./constraints";
import { normalizeRelativeDeadline } from "./deadline-normalization";
import {
  rankEvidencePendingCandidates,
  rankQualifyingCandidates,
  type RankedCandidate
} from "./ranking";

export type RecommendationDecisionStatus =
  | "READY"
  | "BLOCKED_UNKNOWN"
  | "NO_VALID_OPTIONS";

export type CandidateProvenance = {
  quoteId: string;
  providerId: string;
  source: Quote["source"];
  sourceReference?: string;
};

export type RecommendationResult = {
  decisionStatus: RecommendationDecisionStatus;
  selected?: RankedCandidate;
  alternatives: RankedCandidate[];
  pendingEvidence: RankedCandidate[];
  exclusions: Array<{
    quoteId: string;
    providerId: string;
    reasons: ExclusionReason[];
  }>;
  uncertainties: Array<{
    quoteId: string;
    providerId: string;
    reasons: UncertaintyReason[];
  }>;
  recommendationFactors: string[];
  explanation: string;
  approvalRequired: boolean;
  requiredFacts: string[];
  provenance: CandidateProvenance[];
};

function uniqueRequiredFacts(
  uncertainties: RecommendationResult["uncertainties"]
): string[] {
  const facts = new Set<string>();
  for (const item of uncertainties) {
    for (const reason of item.reasons) facts.add(reason.message);
  }
  return [...facts].sort();
}

function quoteEvidenceSourceLabel(source: Quote["source"]): string {
  switch (source) {
    case "CALL":
      return "quote evidence source: provider call";
    case "SMS":
      return "quote evidence source: provider message";
    case "MANUAL":
      return "quote evidence source: manual entry";
    case "OTHER":
      return "quote evidence source: other recorded evidence";
  }
}

function latestQuotePerProvider(quotes: Quote[]): Quote[] {
  const latest = new Map<string, Quote>();

  for (const quote of quotes) {
    const current = latest.get(quote.providerId);
    if (!current) {
      latest.set(quote.providerId, quote);
      continue;
    }

    const currentTime = Date.parse(current.createdAt);
    const candidateTime = Date.parse(quote.createdAt);
    const candidateIsLater =
      Number.isFinite(candidateTime) &&
      (!Number.isFinite(currentTime) || candidateTime > currentTime);
    const sameTimestampButLaterId =
      candidateTime === currentTime && quote.id.localeCompare(current.id) > 0;

    if (candidateIsLater || sameTimestampButLaterId) {
      latest.set(quote.providerId, quote);
    }
  }

  return [...latest.values()];
}

export function recommend(
  mission: Mission,
  providers: Provider[],
  quotes: Quote[]
): RecommendationResult {
  const normalizedMission: Mission = {
    ...mission,
    deadline: normalizeRelativeDeadline(mission.deadline, mission.createdAt)
  };

  // Preserve all historical Quotes in mission storage for auditability, but only
  // evaluate the latest evidence-backed Quote from each provider. Follow-up calls
  // may supersede earlier incomplete evidence and must not leave stale UNKNOWN
  // candidates blocking a deterministic decision.
  const currentQuotes = latestQuotePerProvider(quotes);
  const evaluations = evaluateCandidates(normalizedMission, providers, currentQuotes);
  const ranked = rankQualifyingCandidates(evaluations);
  const pendingEvidence = rankEvidencePendingCandidates(evaluations);
  const selected = ranked[0];

  const exclusions = evaluations
    .filter((candidate) => candidate.status === "FAIL")
    .map((candidate) => ({
      quoteId: candidate.quote.id,
      providerId: candidate.provider.id,
      reasons: candidate.exclusions
    }));

  const uncertainties = evaluations
    .filter((candidate) => candidate.status === "UNKNOWN")
    .map((candidate) => ({
      quoteId: candidate.quote.id,
      providerId: candidate.provider.id,
      reasons: candidate.uncertainties
    }));

  const provenance = evaluations.map((candidate) => ({
    quoteId: candidate.quote.id,
    providerId: candidate.provider.id,
    source: candidate.quote.source,
    sourceReference: candidate.quote.sourceReference
  }));

  if (selected) {
    const factors = selected.factors.map((factor) => factor.explanation);
    const parts = [
      selected.quote.total !== undefined
        ? `total ₦${selected.quote.total.toLocaleString()}`
        : "unknown total",
      selected.quote.deliveryDate
        ? `delivery ${selected.quote.deliveryDate}`
        : "unknown delivery date",
      selected.provider.verified
        ? "provider profile verification: verified"
        : "provider profile verification: not provided",
      quoteEvidenceSourceLabel(selected.quote.source),
      selected.provider.reliabilityScore !== undefined
        ? `reliability ${selected.provider.reliabilityScore}`
        : undefined
    ].filter(Boolean);

    return {
      decisionStatus: "READY",
      selected,
      alternatives: ranked.slice(1),
      pendingEvidence,
      exclusions,
      uncertainties,
      recommendationFactors: factors,
      explanation: `Recommended because it satisfies every represented hard constraint and has the strongest deterministic qualifying factors: ${parts.join(", ")}.`,
      approvalRequired: mission.approvalRequired,
      requiredFacts: uniqueRequiredFacts(uncertainties),
      provenance
    };
  }

  if (pendingEvidence.length > 0) {
    return {
      decisionStatus: "BLOCKED_UNKNOWN",
      alternatives: [],
      pendingEvidence,
      exclusions,
      uncertainties,
      recommendationFactors: [],
      explanation:
        "No final recommendation is issued because at least one hard constraint remains factually unknown. Evidence-pending candidates are ranked only to prioritize follow-up, not to imply qualification.",
      approvalRequired: mission.approvalRequired,
      requiredFacts: uniqueRequiredFacts(uncertainties),
      provenance
    };
  }

  return {
    decisionStatus: "NO_VALID_OPTIONS",
    alternatives: [],
    pendingEvidence: [],
    exclusions,
    uncertainties,
    recommendationFactors: [],
    explanation: "No candidate satisfies the represented hard constraints.",
    approvalRequired: mission.approvalRequired,
    requiredFacts: [],
    provenance
  };
}
