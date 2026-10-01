import type { Mission, Provider, Quote } from "../schemas";

export type ExclusionCode = "PROVIDER_UNAVAILABLE" | "ITEM_CATEGORY_MISMATCH" | "QUOTE_UNAVAILABLE" | "TOTAL_UNKNOWN" | "OVER_BUDGET" | "DEADLINE_UNKNOWN" | "DEADLINE_MISMATCH";
export type ExclusionReason = { code: ExclusionCode; message: string };
export type CandidateEvaluation = { provider: Provider; quote: Quote; qualifies: boolean; exclusions: ExclusionReason[] };

const aliases: Record<string,string[]> = {
  fabric:["fabric","ankara","cloth","textile","material"],
  food:["food","lunch","meal","breakfast","dinner"],
  photography:["photographer","photography","photo"],
  plumbing:["plumbing","plumber","pipe"],
  electrical:["electrician","electrical","wiring"]
};
const norm=(v:string)=>v.trim().toLowerCase();

export function providerMatchesMissionItem(mission: Mission, provider: Provider): boolean {
  const item=norm(mission.item), category=norm(provider.category);
  return item.includes(category) || category.includes(item) || (aliases[category] ?? []).some(a=>item.includes(a));
}

export function deadlineMatches(missionDeadline:string|undefined, deliveryDate:string|undefined):boolean {
  return missionDeadline !== undefined && deliveryDate !== undefined && norm(missionDeadline)===norm(deliveryDate);
}

export function evaluateCandidate(mission:Mission, provider:Provider, quote:Quote):CandidateEvaluation {
  const exclusions:ExclusionReason[]=[];
  if(!provider.active) exclusions.push({code:"PROVIDER_UNAVAILABLE",message:"Provider is not currently active."});
  if(!providerMatchesMissionItem(mission,provider)) exclusions.push({code:"ITEM_CATEGORY_MISMATCH",message:"Provider category does not match the requested item/service."});
  if(!quote.available) exclusions.push({code:"QUOTE_UNAVAILABLE",message:"Provider response says the requested option is unavailable."});
  if(quote.total===undefined) exclusions.push({code:"TOTAL_UNKNOWN",message:"Total cost is unknown because a required price component is missing."});
  if(mission.budget!==undefined && quote.total!==undefined && quote.total>mission.budget) exclusions.push({code:"OVER_BUDGET",message:`Total ₦${quote.total.toLocaleString()} exceeds the hard budget of ₦${mission.budget.toLocaleString()}.`});
  if(mission.deadline!==undefined && quote.deliveryDate===undefined) exclusions.push({code:"DEADLINE_UNKNOWN",message:"Delivery date is unknown, so the deadline cannot be verified."});
  else if(mission.deadline!==undefined && quote.deliveryDate!==undefined && !deadlineMatches(mission.deadline,quote.deliveryDate)) exclusions.push({code:"DEADLINE_MISMATCH",message:`Quoted delivery date "${quote.deliveryDate}" does not match the mission deadline "${mission.deadline}".`});
  return {provider,quote,qualifies:exclusions.length===0,exclusions};
}

export function evaluateCandidates(mission:Mission,providers:Provider[],quotes:Quote[]):CandidateEvaluation[] {
  const byId=new Map(providers.map(p=>[p.id,p]));
  return quotes.map(q=>{
    const provider=byId.get(q.providerId);
    if(!provider) return {provider:{id:q.providerId,name:"Unknown provider",category:"Unknown",location:"Unknown",languages:[],verified:false,active:false},quote:q,qualifies:false,exclusions:[{code:"PROVIDER_UNAVAILABLE",message:"Provider record is missing."}]};
    return evaluateCandidate(mission,provider,q);
  });
}