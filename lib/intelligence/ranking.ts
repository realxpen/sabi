import type { Provider, Quote } from "../schemas";
import type { CandidateEvaluation } from "./constraints";

export type RecommendationFactor = {
  code: "TOTAL_PRICE" | "VERIFICATION" | "RELIABILITY" | "RATING";
  value: string;
  explanation: string;
};

export type RankedCandidate = CandidateEvaluation & {
  factors: RecommendationFactor[];
};

function factors(provider: Provider, quote: Quote): RecommendationFactor[] {
  const out: RecommendationFactor[] = [];

  if (quote.total !== undefined) {
    out.push({
      code: "TOTAL_PRICE",
      value: String(quote.total),
      explanation: `Total quoted cost is ₦${quote.total.toLocaleString()}.`
    });
  }

  out.push({
    code: "VERIFICATION",
    value: String(provider.verified),
    explanation: provider.verified
      ? "Provider profile verification is marked verified in the supplied provider data."
      : "Provider profile verification is not provided in the supplied provider data. This is separate from the quote evidence source and does not mean the Quote itself is unverified."
  });

  if (provider.reliabilityScore !== undefined) {
    out.push({
      code: "RELIABILITY",
      value: String(provider.reliabilityScore),
      explanation: `Reliability score is ${provider.reliabilityScore} in the supplied provider data.`
    });
  }

  if (provider.rating !== undefined) {
    out.push({
      code: "RATING",
      value: String(provider.rating),
      explanation: `Provider rating is ${provider.rating}/5 in the supplied provider data.`
    });
  }

  return out;
}

function rank(candidates: CandidateEvaluation[]): RankedCandidate[] {
  return candidates
    .map((candidate) => ({
      ...candidate,
      factors: factors(candidate.provider, candidate.quote)
    }))
    .sort((a, b) => {
      const price = (a.quote.total ?? Infinity) - (b.quote.total ?? Infinity);
      if (price) return price;

      const verified = Number(b.provider.verified) - Number(a.provider.verified);
      if (verified) return verified;

      const reliability =
        (b.provider.reliabilityScore ?? -1) - (a.provider.reliabilityScore ?? -1);
      if (reliability) return reliability;

      const rating = (b.provider.rating ?? -1) - (a.provider.rating ?? -1);
      if (rating) return rating;

      const providerId = a.provider.id.localeCompare(b.provider.id);
      if (providerId) return providerId;
      return a.quote.id.localeCompare(b.quote.id);
    });
}

export function rankQualifyingCandidates(
  candidates: CandidateEvaluation[]
): RankedCandidate[] {
  return rank(candidates.filter((candidate) => candidate.status === "PASS"));
}

export function rankEvidencePendingCandidates(
  candidates: CandidateEvaluation[]
): RankedCandidate[] {
  return rank(candidates.filter((candidate) => candidate.status === "UNKNOWN"));
}
