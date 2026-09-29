import { z } from "zod";

export const missionTypeSchema = z.enum(["PROCUREMENT", "SERVICE"]);

export const missionStatusSchema = z.enum([
  "CREATED",
  "UNDERSTANDING",
  "PLANNING",
  "SEARCHING",
  "CONTACTING",
  "COLLECTING_QUOTES",
  "COMPARING",
  "AWAITING_APPROVAL",
  "APPROVED",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "ESCALATED"
]);

export const missionSchema = z.object({
  id: z.string().min(1),
  type: missionTypeSchema,
  status: missionStatusSchema,
  rawRequest: z.string().trim().min(1),
  item: z.string().trim().min(1),
  quantity: z.number().positive().optional(),
  unit: z.string().trim().min(1).optional(),
  budget: z.number().nonnegative().optional(),
  location: z.string().trim().min(1).optional(),
  deadline: z.string().trim().min(1).optional(),
  preferences: z.array(z.string().trim().min(1)).optional(),
  approvalRequired: z.boolean(),
  createdAt: z.string().datetime()
});

export type MissionType = z.infer<typeof missionTypeSchema>;
export type MissionStatus = z.infer<typeof missionStatusSchema>;
export type Mission = z.infer<typeof missionSchema>;
