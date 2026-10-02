import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import {
  quoteSchema,
  quoteSourceSchema,
  type Quote
} from "../../schemas";
import {
  type QuoteRepository,
  validateStoredQuote
} from "../../repositories/quote-repository";

const neonQuoteRepositoryEnvironmentSchema = z.object({
  DATABASE_URL: z
    .string()
    .trim()
    .min(1)
    .refine(
      (value) =>
        value.startsWith("postgresql://") || value.startsWith("postgres://"),
      "DATABASE_URL must be a PostgreSQL connection string."
    )
});

export type NeonQuoteRepositoryEnvironmentInput = {
  [key: string]: string | undefined;
};

export type NeonSql = ReturnType<typeof neon>;

const storedNumberSchema = z.coerce.number().finite().nonnegative().nullable();
const storedPositiveNumberSchema = z.coerce.number().finite().positive().nullable().optional();
const storedTimestampSchema = z
  .union([z.string().datetime(), z.date()])
  .transform((value) => (value instanceof Date ? value.toISOString() : value));

const neonQuoteRowSchema = z.object({
  id: z.string().min(1),
  mission_id: z.string().min(1),
  provider_id: z.string().min(1),
  available: z.boolean(),
  quantity: storedPositiveNumberSchema,
  unit: z.string().trim().min(1).nullable().optional(),
  price: storedNumberSchema,
  delivery_fee: storedNumberSchema,
  total: storedNumberSchema,
  delivery_date: z.string().min(1).nullable(),
  notes: z.string().min(1).nullable(),
  source: quoteSourceSchema,
  source_reference: z.string().min(1).nullable(),
  created_at: storedTimestampSchema
});

export class NeonQuoteRepositoryConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NeonQuoteRepositoryConfigurationError";
  }
}

export class NeonQuoteRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NeonQuoteRepositoryError";
  }
}

function fromStorageRow(row: unknown): Quote {
  const stored = neonQuoteRowSchema.parse(row);

  return validateStoredQuote({
    id: stored.id,
    missionId: stored.mission_id,
    providerId: stored.provider_id,
    available: stored.available,
    quantity: stored.quantity ?? undefined,
    unit: stored.unit ?? undefined,
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

function firstStoredQuote(rows: unknown, operation: string): Quote | undefined {
  try {
    const parsedRows = z.array(neonQuoteRowSchema).parse(rows);
    return parsedRows[0] ? fromStorageRow(parsedRows[0]) : undefined;
  } catch {
    throw new NeonQuoteRepositoryError(
      `Neon returned an invalid Quote row during ${operation}.`
    );
  }
}

export class NeonQuoteRepository implements QuoteRepository {
  private readonly sql: NeonSql;

  constructor(
    environment: NeonQuoteRepositoryEnvironmentInput,
    sql?: NeonSql
  ) {
    const parsed = neonQuoteRepositoryEnvironmentSchema.safeParse(environment);

    if (!parsed.success) {
      throw new NeonQuoteRepositoryConfigurationError(
        "DATABASE_URL is required for durable Neon Quote persistence."
      );
    }

    this.sql = sql ?? neon(parsed.data.DATABASE_URL);
  }

  async save(candidate: Quote): Promise<Quote> {
    const quote = quoteSchema.parse(candidate);

    let rows: unknown;
    try {
      rows = await this.sql`
        INSERT INTO quotes (
          id,
          mission_id,
          provider_id,
          available,
          quantity,
          unit,
          price,
          delivery_fee,
          total,
          delivery_date,
          notes,
          source,
          source_reference,
          created_at
        ) VALUES (
          ${quote.id},
          ${quote.missionId},
          ${quote.providerId},
          ${quote.available},
          ${quote.quantity ?? null},
          ${quote.unit ?? null},
          ${quote.price ?? null},
          ${quote.deliveryFee ?? null},
          ${quote.total ?? null},
          ${quote.deliveryDate ?? null},
          ${quote.notes ?? null},
          ${quote.source},
          ${quote.sourceReference ?? null},
          ${quote.createdAt}
        )
        RETURNING
          id,
          mission_id,
          provider_id,
          available,
          quantity,
          unit,
          price,
          delivery_fee,
          total,
          delivery_date,
          notes,
          source,
          source_reference,
          created_at
      `;
    } catch {
      throw new NeonQuoteRepositoryError("Neon Quote persistence query failed.");
    }

    const stored = firstStoredQuote(rows, "persistence");

    if (!stored) {
      throw new NeonQuoteRepositoryError(
        "Neon Quote persistence returned no stored Quote."
      );
    }

    return stored;
  }

  async getById(quoteId: string): Promise<Quote | undefined> {
    const id = z.string().trim().min(1).parse(quoteId);

    let rows: unknown;
    try {
      rows = await this.sql`
        SELECT
          id,
          mission_id,
          provider_id,
          available,
          quantity,
          unit,
          price,
          delivery_fee,
          total,
          delivery_date,
          notes,
          source,
          source_reference,
          created_at
        FROM quotes
        WHERE id = ${id}
        LIMIT 1
      `;
    } catch {
      throw new NeonQuoteRepositoryError("Neon Quote lookup query failed.");
    }

    return firstStoredQuote(rows, "lookup");
  }
}

export function createNeonQuoteRepositoryFromEnvironment(
  environment: NeonQuoteRepositoryEnvironmentInput = process.env,
  sql?: NeonSql
): NeonQuoteRepository | undefined {
  if (!environment.DATABASE_URL?.trim()) {
    return undefined;
  }

  return new NeonQuoteRepository(environment, sql);
}
