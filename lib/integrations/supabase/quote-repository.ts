import { z } from "zod";
import { quoteSchema, type Quote } from "../../schemas";
import {
  type QuoteRepository,
  validateStoredQuote
} from "../../repositories/quote-repository";

const supabaseQuoteRepositoryEnvironmentSchema = z.object({
  SUPABASE_URL: z.string().trim().url(),
  SUPABASE_SECRET_KEY: z.string().trim().min(1)
});

type SupabaseQuoteRepositoryEnvironment = z.infer<
  typeof supabaseQuoteRepositoryEnvironmentSchema
>;

export type SupabaseQuoteRepositoryEnvironmentInput = {
  [key: string]: string | undefined;
};

export type SupabaseQuoteRepositoryFetch = typeof fetch;

const supabaseQuoteRowSchema = z.object({
  id: z.string().min(1),
  mission_id: z.string().min(1),
  provider_id: z.string().min(1),
  available: z.boolean(),
  price: z.number().nonnegative().nullable(),
  delivery_fee: z.number().nonnegative().nullable(),
  total: z.number().nonnegative().nullable(),
  delivery_date: z.string().min(1).nullable(),
  notes: z.string().min(1).nullable(),
  source: z.enum(["CALL", "SMS", "MANUAL", "OTHER"]),
  source_reference: z.string().min(1).nullable(),
  created_at: z.string().datetime()
});

type SupabaseQuoteRow = z.infer<typeof supabaseQuoteRowSchema>;

export class SupabaseQuoteRepositoryConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseQuoteRepositoryConfigurationError";
  }
}

export class SupabaseQuoteRepositoryError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "SupabaseQuoteRepositoryError";
    this.status = status;
  }
}

function toStorageRow(quote: Quote): SupabaseQuoteRow {
  const validated = quoteSchema.parse(quote);

  return {
    id: validated.id,
    mission_id: validated.missionId,
    provider_id: validated.providerId,
    available: validated.available,
    price: validated.price ?? null,
    delivery_fee: validated.deliveryFee ?? null,
    total: validated.total ?? null,
    delivery_date: validated.deliveryDate ?? null,
    notes: validated.notes ?? null,
    source: validated.source,
    source_reference: validated.sourceReference ?? null,
    created_at: validated.createdAt
  };
}

function fromStorageRow(row: unknown): Quote {
  const stored = supabaseQuoteRowSchema.parse(row);

  return validateStoredQuote({
    id: stored.id,
    missionId: stored.mission_id,
    providerId: stored.provider_id,
    available: stored.available,
    price: stored.price ?? undefined,
    deliveryFee: stored.delivery_fee ?? undefined,
    total: stored.total ?? undefined,
    deliveryDate: stored.delivery_date ?? undefined,
    notes: stored.notes ?? undefined,
    source: stored.source,
    sourceReference: stored.source_reference ?? undefined,
    createdAt: stored.created_at
  });
}

function buildHeaders(configuration: SupabaseQuoteRepositoryEnvironment) {
  return {
    apikey: configuration.SUPABASE_SECRET_KEY,
    authorization: `Bearer ${configuration.SUPABASE_SECRET_KEY}`,
    "content-type": "application/json"
  };
}

export class SupabaseQuoteRepository implements QuoteRepository {
  private readonly configuration: SupabaseQuoteRepositoryEnvironment;
  private readonly fetchImpl: SupabaseQuoteRepositoryFetch;

  constructor(
    environment: SupabaseQuoteRepositoryEnvironmentInput,
    fetchImpl: SupabaseQuoteRepositoryFetch = fetch
  ) {
    const parsed = supabaseQuoteRepositoryEnvironmentSchema.safeParse(environment);

    if (!parsed.success) {
      throw new SupabaseQuoteRepositoryConfigurationError(
        "SUPABASE_URL and SUPABASE_SECRET_KEY are required for durable Quote persistence."
      );
    }

    this.configuration = parsed.data;
    this.fetchImpl = fetchImpl;
  }

  async save(quote: Quote): Promise<Quote> {
    const url = new URL("/rest/v1/quotes", this.configuration.SUPABASE_URL);
    const response = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        ...buildHeaders(this.configuration),
        prefer: "return=representation"
      },
      body: JSON.stringify(toStorageRow(quote))
    });

    if (!response.ok) {
      throw new SupabaseQuoteRepositoryError(
        `Quote persistence failed with status ${response.status}.`,
        response.status
      );
    }

    const rows = z.array(supabaseQuoteRowSchema).parse(await response.json());
    const stored = rows[0];

    if (!stored) {
      throw new SupabaseQuoteRepositoryError(
        "Quote persistence returned no stored Quote."
      );
    }

    return fromStorageRow(stored);
  }

  async getById(quoteId: string): Promise<Quote | undefined> {
    const id = z.string().trim().min(1).parse(quoteId);
    const url = new URL("/rest/v1/quotes", this.configuration.SUPABASE_URL);
    url.searchParams.set("id", `eq.${id}`);
    url.searchParams.set("select", "*");
    url.searchParams.set("limit", "1");

    const response = await this.fetchImpl(url, {
      method: "GET",
      headers: buildHeaders(this.configuration)
    });

    if (!response.ok) {
      throw new SupabaseQuoteRepositoryError(
        `Quote lookup failed with status ${response.status}.`,
        response.status
      );
    }

    const rows = z.array(supabaseQuoteRowSchema).parse(await response.json());
    return rows[0] ? fromStorageRow(rows[0]) : undefined;
  }
}

export function createSupabaseQuoteRepositoryFromEnvironment(
  environment: SupabaseQuoteRepositoryEnvironmentInput = process.env,
  fetchImpl: SupabaseQuoteRepositoryFetch = fetch
): SupabaseQuoteRepository | undefined {
  const hasUrl = Boolean(environment.SUPABASE_URL?.trim());
  const hasSecret = Boolean(environment.SUPABASE_SECRET_KEY?.trim());

  if (!hasUrl && !hasSecret) {
    return undefined;
  }

  return new SupabaseQuoteRepository(environment, fetchImpl);
}
