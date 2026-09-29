import {
  providerSchema,
  quoteSchema,
  type Mission,
  type Provider,
  type Quote
} from "../schemas";

/**
 * Temporary Phase 1 fixtures owned by the Xpen orchestration track.
 * Femi's intelligence/data track will replace these with the canonical
 * demo dataset and matching/recommendation implementation.
 */
export const temporaryDemoProviders: Provider[] = [
  providerSchema.parse({
    id: "provider-ade-textiles",
    name: "Ade Textiles (Demo)",
    category: "Fabric",
    location: "Surulere",
    languages: ["English", "Pidgin"],
    verified: true,
    rating: 4.8,
    completedTransactions: 31,
    reliabilityScore: 0.94,
    active: true
  }),
  providerSchema.parse({
    id: "provider-tola-fabrics",
    name: "Tola Fabrics (Demo)",
    category: "Fabric",
    location: "Yaba",
    languages: ["English", "Yoruba"],
    verified: true,
    rating: 4.5,
    completedTransactions: 18,
    reliabilityScore: 0.88,
    active: true
  }),
  providerSchema.parse({
    id: "provider-mariam-fabrics",
    name: "Mariam Fabrics (Demo)",
    category: "Fabric",
    location: "Lagos Island",
    languages: ["English", "Yoruba"],
    verified: false,
    rating: 4.2,
    completedTransactions: 9,
    reliabilityScore: 0.8,
    active: true
  })
];

export function buildTemporaryDemoQuotes(mission: Mission): Quote[] {
  const now = new Date().toISOString();

  return [
    quoteSchema.parse({
      id: "quote-ade-textiles",
      missionId: mission.id,
      providerId: "provider-ade-textiles",
      available: true,
      price: 60000,
      deliveryFee: 3000,
      total: 63000,
      deliveryDate: "tomorrow",
      notes: "Phase 1 mock response; no real provider was contacted.",
      source: "MANUAL",
      sourceReference: "phase1-mock-scenario",
      createdAt: now
    }),
    quoteSchema.parse({
      id: "quote-tola-fabrics",
      missionId: mission.id,
      providerId: "provider-tola-fabrics",
      available: true,
      price: 64000,
      deliveryFee: 3000,
      total: 67000,
      deliveryDate: "tomorrow",
      notes: "Phase 1 mock response; no real provider was contacted.",
      source: "MANUAL",
      sourceReference: "phase1-mock-scenario",
      createdAt: now
    }),
    quoteSchema.parse({
      id: "quote-mariam-fabrics",
      missionId: mission.id,
      providerId: "provider-mariam-fabrics",
      available: false,
      notes: "Phase 1 mock response: requested quantity unavailable.",
      source: "MANUAL",
      sourceReference: "phase1-mock-scenario",
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
    .sort((a, b) => (a.total ?? Infinity) - (b.total ?? Infinity))[0];
}
