import type { Mission, Provider, Quote } from "../schemas";
import { retrieveKnowledge, type KnowledgeTopic } from "./knowledge";
export type MissionIntelligenceContext={mission:Mission;knowledge:ReturnType<typeof retrieveKnowledge>;providers:Provider[];quotes:Quote[];provenance:string[]};
export function assembleMissionContext(mission:Mission,providers:Provider[],quotes:Quote[],topics?:KnowledgeTopic[]):MissionIntelligenceContext{
  const knowledge=retrieveKnowledge(mission,topics);
  return {mission,knowledge,providers,quotes,provenance:knowledge.map(k=>k.source)};
}