import { z } from "zod";

export const providerSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  category: z.string().trim().min(1),
  phone: z.string().trim().min(1).optional(),
  location: z.string().trim().min(1),
  languages: z.array(z.string().trim().min(1)),
  verified: z.boolean(),
  rating: z.number().min(0).max(5).optional(),
  completedTransactions: z.number().int().nonnegative().optional(),
  reliabilityScore: z.number().min(0).max(1).optional(),
  active: z.boolean()
});

export type Provider = z.infer<typeof providerSchema>;
