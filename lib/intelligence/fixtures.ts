import {
  communicationResultSchema,
  providerSchema,
  quoteSchema,
  type CommunicationResult,
  type Mission,
  type Provider,
  type Quote
} from "../schemas";

export const intelligenceDemoProviders: Provider[] = [
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
  }),
  providerSchema.parse({
    id: "provider-bola-textiles",
    name: "Bola Textiles (Demo)",
    category: "Fabric",
    location: "Yaba",
    languages: ["English"],
    verified: true,
    rating: 4.7,
    completedTransactions: 27,
    reliabilityScore: 0.91,
    active: true
  }),
  providerSchema.parse({
    id: "provider-sade-fabrics",
    name: "Sade Fabrics (Demo)",
    category: "Fabric",
    location: "Ikeja",
    languages: ["English", "Yoruba"],
    verified: true,
    rating: 4.9,
    completedTransactions: 42,
    reliabilityScore: 0.97,
    active: true
  }),
  providerSchema.parse({
    id: "provider-unavailable-textiles",
    name: "Unavailable Textiles (Demo)",
    category: "Fabric",
    location: "Yaba",
    languages: ["English"],
    verified: true,
    rating: 4.6,
    completedTransactions: 21,
    reliabilityScore: 0.9,
    active: false
  }),
  providerSchema.parse({
    id: "provider-wrong-category",
    name: "Ade Plumbing (Demo)",
    category: "Plumbing",
    location: "Yaba",
    languages: ["English"],
    verified: true,
    rating: 4.9,
    completedTransactions: 40,
    reliabilityScore: 0.98,
    active: true
  })
];

function confirmedRequestedQuantityFixture(mission: Mission): Pick<Quote, "quantity" | "unit"> | Record<string, never> {
  if (mission.quantity === undefined) return {};

  // Synthetic fixture contract: these available-provider rows explicitly model
  // the provider confirming the requested amount. Production code must never
  // populate Quote.quantity by copying Mission.quantity without provider evidence.
  return {
    quantity: mission.quantity,
    ...(mission.unit === undefined ? {} : { unit: mission.unit })
  };
}

export function buildIntelligenceDemoQuotes(mission: Mission): Quote[] {
  const now = new Date().toISOString();
  const confirmedQuantity = confirmedRequestedQuantityFixture(mission);

  return [
    {
      id: "quote-ade-textiles",
      missionId: mission.id,
      providerId: "provider-ade-textiles",
      available: true,
      ...confirmedQuantity,
      price: 60000,
      deliveryFee: 3000,
      total: 63000,
      deliveryDate: "tomorrow",
      notes: "Fictional fixture: complete qualifying offer with explicit quantity confirmation.",
      source: "MANUAL",
      sourceReference: "femi-intelligence-fixtures",
      createdAt: now
    },
    {
      id: "quote-tola-fabrics",
      missionId: mission.id,
      providerId: "provider-tola-fabrics",
      available: true,
      ...confirmedQuantity,
      price: 64000,
      deliveryFee: 3000,
      total: 67000,
      deliveryDate: "tomorrow",
      notes: "Fictional fixture: valid alternative with explicit quantity confirmation.",
      source: "MANUAL",
      sourceReference: "femi-intelligence-fixtures",
      createdAt: now
    },
    {
      id: "quote-mariam-fabrics",
      missionId: mission.id,
      providerId: "provider-mariam-fabrics",
      available: false,
      notes: "Fictional fixture: requested quantity unavailable.",
      source: "MANUAL",
      sourceReference: "femi-intelligence-fixtures",
      createdAt: now
    },
    {
      id: "quote-bola-late",
      missionId: mission.id,
      providerId: "provider-bola-textiles",
      available: true,
      ...confirmedQuantity,
      price: 55000,
      deliveryFee: 2000,
      total: 57000,
      deliveryDate: "in 3 days",
      notes: "Fictional fixture: quantity-valid but deadline-invalid.",
      source: "CALL",
      sourceReference: "demo-call-bola-late",
      createdAt: now
    },
    {
      id: "quote-sade-over-budget",
      missionId: mission.id,
      providerId: "provider-sade-fabrics",
      available: true,
      ...confirmedQuantity,
      price: 76000,
      deliveryFee: 3000,
      total: 79000,
      deliveryDate: "tomorrow",
      notes: "Fictional fixture: quantity/deadline-valid but over hard budget.",
      source: "CALL",
      sourceReference: "demo-call-sade-over-budget",
      createdAt: now
    },
    {
      id: "quote-missing-delivery-fee",
      missionId: mission.id,
      providerId: "provider-tola-fabrics",
      available: true,
      ...confirmedQuantity,
      price: 62000,
      deliveryDate: "tomorrow",
      notes: "Fictional fixture: quantity confirmed; delivery fee unknown; total unknown.",
      source: "CALL",
      sourceReference: "demo-call-missing-delivery-fee",
      createdAt: now
    },
    {
      id: "quote-unavailable-provider",
      missionId: mission.id,
      providerId: "provider-unavailable-textiles",
      available: false,
      notes: "Fictional fixture: provider currently unavailable.",
      source: "OTHER",
      sourceReference: "demo-provider-unavailable",
      createdAt: now
    }
  ].map((quote) => quoteSchema.parse(quote));
}

export const intelligenceDemoCommunications: CommunicationResult[] = [
  communicationResultSchema.parse({
    id: "communication-no-answer",
    missionId: "canonical-ankara-mission",
    providerId: "provider-mariam-fabrics",
    channel: "CALL",
    status: "NO_ANSWER",
    summary: "Fictional fixture: provider did not answer.",
    occurredAt: "2026-10-01T18:00:00.000Z"
  })
];
