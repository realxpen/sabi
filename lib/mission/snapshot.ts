import { z } from "zod";
import {
  communicationResultSchema,
  missionSchema,
  missionStepSchema,
  providerSchema,
  quoteSchema
} from "../schemas";

export const missionRecommendationSchema = z.object({
  providerId: z.string().min(1),
  quoteId: z.string().min(1),
  reasons: z.array(z.string().trim().min(1)).min(1)
});

export const missionSnapshotSchema = z.object({
  mission: missionSchema,
  steps: z.array(missionStepSchema),
  providers: z.array(providerSchema),
  communications: z.array(communicationResultSchema),
  quotes: z.array(quoteSchema),
  recommendation: missionRecommendationSchema.optional(),
  demoMode: z.boolean()
});

export type MissionRecommendation = z.infer<
  typeof missionRecommendationSchema
>;
export type MissionSnapshot = z.infer<typeof missionSnapshotSchema>;
