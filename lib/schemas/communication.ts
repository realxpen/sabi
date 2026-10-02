import { z } from "zod";

export const communicationChannelSchema = z.enum([
  "CALL",
  "SMS",
  "MOCK",
  "OTHER"
]);

export const communicationStatusSchema = z.enum([
  "INITIATED",
  "IN_PROGRESS",
  "COMPLETED",
  "NO_ANSWER",
  "UNAVAILABLE",
  "FAILED"
]);

export const communicationObservationSchema = z.object({
  available: z.boolean().optional(),
  quantity: z.number().positive().optional(),
  unit: z.string().trim().min(1).optional(),
  price: z.number().nonnegative().optional(),
  deliveryFee: z.number().nonnegative().optional(),
  total: z.number().nonnegative().optional(),
  deliveryDate: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional()
});

export const communicationResultSchema = z.object({
  id: z.string().min(1),
  missionId: z.string().min(1),
  providerId: z.string().min(1),
  channel: communicationChannelSchema,
  status: communicationStatusSchema,
  externalId: z.string().trim().min(1).optional(),
  summary: z.string().trim().min(1).optional(),
  observation: communicationObservationSchema.optional(),
  errorCode: z.string().trim().min(1).optional(),
  occurredAt: z.string().datetime()
});

export type CommunicationChannel = z.infer<
  typeof communicationChannelSchema
>;
export type CommunicationStatus = z.infer<
  typeof communicationStatusSchema
>;
export type CommunicationObservation = z.infer<
  typeof communicationObservationSchema
>;
export type CommunicationResult = z.infer<
  typeof communicationResultSchema
>;
