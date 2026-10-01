import type { Provider, Quote } from "../schemas";
import type { CandidateEvaluation } from "./constraints";

export type RecommendationFactor={code:"TOTAL_PRICE"|"VERIFICATION"|"RELIABILITY"|"RATING";value:string;explanation:string};
export type RankedCandidate=CandidateEvaluation & {factors:RecommendationFactor[]};

function factors(provider:Provider,quote:Quote):RecommendationFactor[]{
  const out:RecommendationFactor[]=[];
  if(quote.total!==undefined) out.push({code:"TOTAL_PRICE",value:String(quote.total),explanation:`Total quoted cost is ₦${quote.total.toLocaleString()}.`});
  out.push({code:"VERIFICATION",value:String(provider.verified),explanation:provider.verified?"Provider is marked verified in the supplied provider data.":"Provider is not marked verified in the supplied provider data."});
  if(provider.reliabilityScore!==undefined) out.push({code:"RELIABILITY",value:String(provider.reliabilityScore),explanation:`Reliability score is ${provider.reliabilityScore} in the supplied provider data.`});
  if(provider.rating!==undefined) out.push({code:"RATING",value:String(provider.rating),explanation:`Provider rating is ${provider.rating}/5 in the supplied provider data.`});
  return out;
}

export function rankQualifyingCandidates(candidates:CandidateEvaluation[]):RankedCandidate[]{
  return candidates.filter(c=>c.qualifies).map(c=>({...c,factors:factors(c.provider,c.quote)})).sort((a,b)=>{
    const price=(a.quote.total??Infinity)-(b.quote.total??Infinity); if(price) return price;
    const verified=Number(b.provider.verified)-Number(a.provider.verified); if(verified) return verified;
    const reliability=(b.provider.reliabilityScore??-1)-(a.provider.reliabilityScore??-1); if(reliability) return reliability;
    const rating=(b.provider.rating??-1)-(a.provider.rating??-1); if(rating) return rating;
    return a.provider.id.localeCompare(b.provider.id);
  });
}