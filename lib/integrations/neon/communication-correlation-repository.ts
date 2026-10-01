import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import type {
  CommunicationCorrelation,
  CommunicationCorrelationRepository
} from "../../repositories/communication-correlation-repository";

const environmentSchema = z.object({
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

const storedTimestampSchema = z
  .union([z.string().datetime(), z.date()])
  .transform((value) => (value instanceof Date ? value.toISOString() : value));

const correlationSchema = z.object({
  communicationId: z.string().trim().min(1),
  externalId: z.string().trim().min(1).optional(),
  missionId: z.string().trim().min(1),
  providerId: z.string().trim().min(1),
  channel: z.literal("SMS"),
  createdAt: z.string().datetime()
});

const rowSchema = z.object({
  communication_id: z.string().min(1),
  external_id: z.string().min(1).nullable(),
  mission_id: z.string().min(1),
  provider_id: z.string().min(1),
  channel: z.literal("SMS"),
  created_at: storedTimestampSchema
});

export type NeonCommunicationCorrelationEnvironment = {
  [key: string]: string | undefined;
};

export type NeonCommunicationCorrelationSql = ReturnType<typeof neon>;

export class NeonCommunicationCorrelationConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NeonCommunicationCorrelationConfigurationError";
  }
}

export class NeonCommunicationCorrelationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NeonCommunicationCorrelationError";
  }
}

function fromRow(row: unknown): CommunicationCorrelation {
  const stored = rowSchema.parse(row);
  return correlationSchema.parse({
    communicationId: stored.communication_id,
    externalId: stored.external_id ?? undefined,
    missionId: stored.mission_id,
    providerId: stored.provider_id,
    channel: stored.channel,
    createdAt: stored.created_at
  });
}

function firstRow(
  rows: unknown,
  operation: string
): CommunicationCorrelation | undefined {
  try {
    const parsed = z.array(rowSchema).parse(rows);
    return parsed[0] ? fromRow(parsed[0]) : undefined;
  } catch {
    throw new NeonCommunicationCorrelationError(
      `Neon returned an invalid communication correlation row during ${operation}.`
    );
  }
}

export class NeonCommunicationCorrelationRepository
  implements CommunicationCorrelationRepository
{
  private readonly sql: NeonCommunicationCorrelationSql;

  constructor(
    environment: NeonCommunicationCorrelationEnvironment,
    sql?: NeonCommunicationCorrelationSql
  ) {
    const parsed = environmentSchema.safeParse(environment);
    if (!parsed.success) {
      throw new NeonCommunicationCorrelationConfigurationError(
        "DATABASE_URL is required for durable communication correlation."
      );
    }
    this.sql = sql ?? neon(parsed.data.DATABASE_URL);
  }

  async savePending(
    candidate: Omit<CommunicationCorrelation, "externalId">
  ): Promise<CommunicationCorrelation> {
    const correlation = correlationSchema.omit({ externalId: true }).parse(candidate);

    let rows: unknown;
    try {
      rows = await this.sql`
        INSERT INTO communication_correlations (
          communication_id,
          external_id,
          mission_id,
          provider_id,
          channel,
          created_at
        ) VALUES (
          ${correlation.communicationId},
          NULL,
          ${correlation.missionId},
          ${correlation.providerId},
          ${correlation.channel},
          ${correlation.createdAt}
        )
        ON CONFLICT (communication_id) DO NOTHING
        RETURNING
          communication_id,
          external_id,
          mission_id,
          provider_id,
          channel,
          created_at
      `;
    } catch {
      throw new NeonCommunicationCorrelationError(
        "Neon communication correlation persistence query failed."
      );
    }

    const inserted = firstRow(rows, "persistence");
    if (inserted) return inserted;

    const existing = await this.getByCommunicationId(correlation.communicationId);
    if (!existing) {
      throw new NeonCommunicationCorrelationError(
        "Neon communication correlation persistence returned no stored row."
      );
    }

    if (
      existing.missionId !== correlation.missionId ||
      existing.providerId !== correlation.providerId ||
      existing.channel !== correlation.channel
    ) {
      throw new NeonCommunicationCorrelationError(
        "Communication ID is already correlated to a different mission or provider."
      );
    }

    return existing;
  }

  async attachExternalId(
    communicationId: string,
    externalId: string
  ): Promise<CommunicationCorrelation> {
    const id = z.string().trim().min(1).parse(communicationId);
    const external = z.string().trim().min(1).parse(externalId);

    let rows: unknown;
    try {
      rows = await this.sql`
        UPDATE communication_correlations
        SET external_id = ${external}
        WHERE communication_id = ${id}
          AND (external_id IS NULL OR external_id = ${external})
        RETURNING
          communication_id,
          external_id,
          mission_id,
          provider_id,
          channel,
          created_at
      `;
    } catch {
      throw new NeonCommunicationCorrelationError(
        "Neon communication correlation update query failed."
      );
    }

    const stored = firstRow(rows, "external ID attachment");
    if (!stored) {
      throw new NeonCommunicationCorrelationError(
        "Could not attach the external message ID to its communication correlation."
      );
    }

    return stored;
  }

  async getByCommunicationId(
    communicationId: string
  ): Promise<CommunicationCorrelation | undefined> {
    const id = z.string().trim().min(1).parse(communicationId);

    let rows: unknown;
    try {
      rows = await this.sql`
        SELECT
          communication_id,
          external_id,
          mission_id,
          provider_id,
          channel,
          created_at
        FROM communication_correlations
        WHERE communication_id = ${id}
        LIMIT 1
      `;
    } catch {
      throw new NeonCommunicationCorrelationError(
        "Neon communication correlation lookup query failed."
      );
    }

    return firstRow(rows, "communication lookup");
  }

  async getByExternalId(
    externalId: string
  ): Promise<CommunicationCorrelation | undefined> {
    const id = z.string().trim().min(1).parse(externalId);

    let rows: unknown;
    try {
      rows = await this.sql`
        SELECT
          communication_id,
          external_id,
          mission_id,
          provider_id,
          channel,
          created_at
        FROM communication_correlations
        WHERE external_id = ${id}
        LIMIT 1
      `;
    } catch {
      throw new NeonCommunicationCorrelationError(
        "Neon external communication correlation lookup query failed."
      );
    }

    return firstRow(rows, "external lookup");
  }
}

export function createNeonCommunicationCorrelationRepositoryFromEnvironment(
  environment: NeonCommunicationCorrelationEnvironment = process.env,
  sql?: NeonCommunicationCorrelationSql
): NeonCommunicationCorrelationRepository | undefined {
  if (!environment.DATABASE_URL?.trim()) return undefined;
  return new NeonCommunicationCorrelationRepository(environment, sql);
}
