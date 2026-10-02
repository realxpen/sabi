import {
  providerSchema,
  quoteSchema,
  type Mission,
  type Provider,
  type Quote
} from "../schemas";

/**
 * Canonical hackathon simulation fixtures.
 *
 * These providers and Quotes are deliberately labelled Demo/Manual so the
 * simulation never looks like evidence from real businesses. They are chosen
 * to exercise SABI's hard constraints visibly: one option qualifies, one
 * misses the deadline, and one exceeds the budget.
 */
export const temporaryDemoProviders: Provider[] = [
  providerSchema.parse({
    id: "provider-scenthub-yaba",
    name: "ScentHub Yaba (Demo)",
    category: "Perfume",
    location: "Yaba",
    languages: ["English", "Pidgin"],
    verified: true,
    rating: 4.8,
    completedTransactions: 42,
    reliabilityScore: 0.95,
    active: true
  }),
  providerSchema.parse({
    id: "provider-luxe-aroma",
    name: "Luxe Aroma Surulere (Demo)",
    category: "Perfume",
    location: "Surulere",
    languages: ["English", "Yoruba"],
    verified: true,
    rating: 4.7,
    completedTransactions: 27,
    reliabilityScore: 0.91,
    active: true
  }),
  providerSchema.parse({
    id: "provider-mira-scents",
    name: "Mira Scents (Demo)",
    category: "Perfume",
    location: "Lagos Island",
    languages: ["English", "Yoruba"],
    verified: true,
    rating: 4.6,
    completedTransactions: 19,
    reliabilityScore: 0.89,
    active: true
  })
];

export function buildTemporaryDemoQuotes(mission: Mission): Quote[] {
  const now = new Date().toISOString();

  return [
    quoteSchema.parse({
      id: "quote-scenthub-yaba",
      missionId: mission.id,
      providerId: "provider-scenthub-yaba",
      available: true,
      price: 96000,
      deliveryFee: 5000,
      total: 101000,
      deliveryDate: "tomorrow",
      notes:
        "Simulation fixture: 12 bottles of 50ml long-lasting unisex perfume available. No real provider was contacted.",
      source: "MANUAL",
      sourceReference: "hackathon-perfume-simulation",
      createdAt: now
    }),
    quoteSchema.parse({
      id: "quote-luxe-aroma",
      missionId: mission.id,
      providerId: "provider-luxe-aroma",
      available: true,
      price: 105000,
      deliveryFee: 5000,
      total: 110000,
      deliveryDate: "2 days",
      notes:
        "Simulation fixture: within budget but cannot meet tomorrow's deadline. No real provider was contacted.",
      source: "MANUAL",
      sourceReference: "hackathon-perfume-simulation",
      createdAt: now
    }),
    quoteSchema.parse({
      id: "quote-mira-scents",
      missionId: mission.id,
      providerId: "provider-mira-scents",
      available: true,
      price: 118000,
      deliveryFee: 6000,
      total: 124000,
      deliveryDate: "tomorrow",
      notes:
        "Simulation fixture: can meet the deadline but exceeds the hard budget. No real provider was contacted.",
      source: "MANUAL",
      sourceReference: "hackathon-perfume-simulation",
      createdAt: now
    })
  ];
}

export function selectTemporaryRecommendation(
  mission: Mission,
  quotes: Quote[]
): Quote | undefined {
  return quotes
    .filter((quote) => quote.available)
    .filter((quote) => quote.total !== undefined)
    .filter(
      (quote) =>
        mission.budget === undefined ||
        (quote.total !== undefined && quote.total <= mission.budget)
    )
    .filter(
      (quote) =>
        mission.deadline === undefined ||
        quote.deliveryDate?.trim().toLowerCase() ===
          mission.deadline.trim().toLowerCase()
    )
    .sort((a, b) => (a.total ?? Infinity) - (b.total ?? Infinity))[0];
}
