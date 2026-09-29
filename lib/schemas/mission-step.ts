import { z } from "zod";

export const missionStepStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED"
]);

export const missionStepSchema = z.object({
  id: z.string().min(1),
  missionId: z.string().min(1),
  type: z.string().trim().min(1),
  status: missionStepStatusSchema,
  message: z.string().trim().min(1),
  createdAt: z.string().datetime()
});

export type MissionStepStatus = z.infer<typeof missionStepStatusSchema>;
export type MissionStep = z.infer<typeof missionStepSchema>;
