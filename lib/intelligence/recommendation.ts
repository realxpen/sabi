import type { Mission, Provider, Quote } from "../schemas";
import { evaluateCandidates, type ExclusionReason } from "./constraints";
import { rankQualifyingCandidates, type RankedCandidate } from "./ranking";

export type RecommendationResult={selected?:RankedCandidate;alternatives:RankedCandidate[];exclusions:Array<{quoteId:string;providerId:string;reasons:ExclusionReason[]}>;recommendationFactors:string[];explanation?:string;approvalRequired:boolean};

export function recommend(mission:Mission,providers:Provider[],quotes:Quote[]):RecommendationResult{
  const evaluations=evaluateCandidates(mission,providers,quotes);
  const ranked=rankQualifyingCandidates(evaluations), selected=ranked[0];
  const exclusions=evaluations.filter(c=>!c.qualifies).map(c=>({quoteId:c.quote.id,providerId:c.provider.id,reasons:c.exclusions}));
  if(!selected) return {alternatives:[],exclusions,recommendationFactors:[],approvalRequired:mission.approvalRequired};
  const factors=selected.factors.map(f=>f.explanation);
  const parts=[selected.quote.total!==undefined?`total ₦${selected.quote.total.toLocaleString()}`:"unknown total",selected.quote.deliveryDate?`delivery ${selected.quote.deliveryDate}`:"unknown delivery date",selected.provider.verified?"verified provider":"unverified provider",selected.provider.reliabilityScore!==undefined?`reliability ${selected.provider.reliabilityScore}`:undefined].filter(Boolean);
  return {selected,alternatives:ranked.slice(1),exclusions,recommendationFactors:factors,explanation:`Recommended because it satisfies the represented hard constraints and has the strongest deterministic qualifying factors: ${parts.join(", ")}.`,approvalRequired:mission.approvalRequired};
}