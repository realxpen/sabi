import type { Mission } from "../schemas";
export type KnowledgeTopic="APPROVAL"|"PROCUREMENT"|"TRUST"|"COMMUNICATION"|"TRUTHFULNESS";
export type KnowledgeEntry={id:string;topic:KnowledgeTopic;status:"ACTIVE";source:string;content:string;keywords:string[]};

const entries:KnowledgeEntry[]=[
{id:"knowledge.approval.active",topic:"APPROVAL",status:"ACTIVE",source:"Knowledge/Product/TRUST_MODEL.md",keywords:["approval","purchase","budget","human"],content:"Consequential actions require explicit human approval. SABI may compare and recommend, but the MVP does not purchase, book, send money, release escrow, exceed a hard budget, or materially alter constraints without approval."},
{id:"knowledge.procurement.active",topic:"PROCUREMENT",status:"ACTIVE",source:"Knowledge/Product/MVP_SCOPE.md",keywords:["procurement","provider","quote","deadline","budget"],content:"Procurement follows structured mission, provider discovery, provider contact, quote collection, comparison, recommendation, and human approval."},
{id:"knowledge.trust.active",topic:"TRUST",status:"ACTIVE",source:"Knowledge/Product/TRUST_MODEL.md",keywords:["trust","verified","reliability","provider"],content:"Trust can use verification, completed work, ratings, cancellations, disputes, response rate and fulfilment reliability. Demo verification is seeded data and must not be presented as production verification."},
{id:"knowledge.communication.active",topic:"COMMUNICATION",status:"ACTIVE",source:"Knowledge/Technical/INTEGRATION_CONTRACTS.md",keywords:["communication","call","transcript","quote","no-answer"],content:"Communication initiation is not call completion. A transcript is evidence, not automatically a Quote. No-answer or unavailable communication does not create a fabricated Quote."},
{id:"knowledge.truthfulness.active",topic:"TRUTHFULNESS",status:"ACTIVE",source:"Knowledge/Technical/LLM_KNOWLEDGE_ARCHITECTURE.md",keywords:["unknown","truth","price","availability","delivery","provenance"],content:"Unknown values stay unknown. Live price, availability, delivery promises and call outcomes belong to operational/tool data, not durable Knowledge. Quote fields remain source-traceable."}
];

export function retrieveKnowledge(mission:Mission,requestedTopics?:KnowledgeTopic[]):KnowledgeEntry[]{
  const topics=new Set(requestedTopics??["APPROVAL","PROCUREMENT","TRUTHFULNESS"]);
  const query=`${mission.type} ${mission.item} ${mission.rawRequest} ${mission.deadline??""}`.toLowerCase();
  return entries.filter(e=>topics.has(e.topic)).map(e=>({entry:e,score:e.keywords.reduce((s,k)=>s+(query.includes(k)?1:0),0)})).filter(({score,entry})=>score>0 || (requestedTopics===undefined && entry.topic==="APPROVAL")).sort((a,b)=>b.score-a.score||a.entry.id.localeCompare(b.entry.id)).map(x=>x.entry);
}