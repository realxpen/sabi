import type {
  Mission,
  MissionStep,
  Provider,
  Quote
} from "../schemas";

export type MissionRecommendation = {
  providerId: string;
  quoteId: string;
  reasons: string[];
};

export type MissionSnapshot = {
  mission: Mission;
  steps: MissionStep[];
  providers: Provider[];
  quotes: Quote[];
  recommendation?: MissionRecommendation;
  demoMode: true;
};
