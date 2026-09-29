import { z } from "zod";

export const quoteSourceSchema = z.enum(["CALL", "SMS", "MANUAL", "OTHER"]);

export const quoteSchema = z.object({
  id: z.string().min(1),
  missionId: z.string().min(1),
  providerId: z.string().min(1),
  available: z.boolean(),
  price: z.number().nonnegative().optional(),
  deliveryFee: z.number().nonnegative().optional(),
  total: z.number().nonnegative().optional(),
  deliveryDate: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
  source: quoteSourceSchema,
  sourceReference: z.string().trim().min(1).optional(),
  createdAt: z.string().datetime()
});

export type QuoteSource = z.infer<typeof quoteSourceSchema>;
export type Quote = z.infer<typeof quoteSchema>;
