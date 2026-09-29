import { z } from "zod";

export const approvalStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED"
]);

export const approvalSchema = z.object({
  id: z.string().min(1),
  missionId: z.string().min(1),
  action: z.literal("SELECT_PROVIDER"),
  providerId: z.string().min(1),
  quoteId: z.string().min(1),
  status: approvalStatusSchema,
  createdAt: z.string().datetime()
});

export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;
export type Approval = z.infer<typeof approvalSchema>;
