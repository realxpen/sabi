import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import type { CommunicationEventDeduplicator } from "../communication/event-processor";

const eventIdSchema = z.string().trim().min(1);

const neonDeduplicatorEnvironmentSchema = z.object({
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

const claimedEventRowSchema = z.object({
  event_id: z.string().min(1)
});

export type NeonCommunicationEventDeduplicatorEnvironmentInput = {
  [key: string]: string | undefined;
};

export type NeonCommunicationEventDedupeSql = ReturnType<typeof neon>;

export class NeonCommunicationEventDeduplicatorConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NeonCommunicationEventDeduplicatorConfigurationError";
  }
}

export class NeonCommunicationEventDeduplicatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NeonCommunicationEventDeduplicatorError";
  }
}

/**
 * Durable, process-independent idempotency for verified communication events.
 *
 * Claiming is one atomic INSERT with ON CONFLICT DO NOTHING. Exactly one
 * caller can receive a stored row for a given event_id, even when multiple
 * Vercel instances receive the same provider retry concurrently.
 *
 * Successful claims intentionally remain stored. The event processor calls
 * release() only when normalization/correlation processing throws, allowing a
 * corrected provider retry to be attempted later.
 */
export class NeonCommunicationEventDeduplicator
  implements CommunicationEventDeduplicator
{
  private readonly sql: NeonCommunicationEventDedupeSql;

  constructor(
    environment: NeonCommunicationEventDeduplicatorEnvironmentInput,
    sql?: NeonCommunicationEventDedupeSql
  ) {
    const parsed = neonDeduplicatorEnvironmentSchema.safeParse(environment);

    if (!parsed.success) {
      throw new NeonCommunicationEventDeduplicatorConfigurationError(
        "DATABASE_URL is required for durable Neon communication event deduplication."
      );
    }

    this.sql = sql ?? neon(parsed.data.DATABASE_URL);
  }

  async claim(candidateEventId: string): Promise<boolean> {
    const eventId = eventIdSchema.parse(candidateEventId);

    let rows: unknown;
    try {
      rows = await this.sql`
        INSERT INTO communication_event_claims (event_id)
        VALUES (${eventId})
        ON CONFLICT (event_id) DO NOTHING
        RETURNING event_id
      `;
    } catch {
      throw new NeonCommunicationEventDeduplicatorError(
        "Neon communication event claim query failed."
      );
    }

    let parsedRows: Array<{ event_id: string }>;
    try {
      parsedRows = z.array(claimedEventRowSchema).parse(rows);
    } catch {
      throw new NeonCommunicationEventDeduplicatorError(
        "Neon returned an invalid communication event claim result."
      );
    }

    return parsedRows.length === 1;
  }

  async release(candidateEventId: string): Promise<void> {
    const eventId = eventIdSchema.parse(candidateEventId);

    try {
      await this.sql`
        DELETE FROM communication_event_claims
        WHERE event_id = ${eventId}
      `;
    } catch {
      throw new NeonCommunicationEventDeduplicatorError(
        "Neon communication event release query failed."
      );
    }
  }
}

export function createNeonCommunicationEventDeduplicatorFromEnvironment(
  environment: NeonCommunicationEventDeduplicatorEnvironmentInput = process.env,
  sql?: NeonCommunicationEventDedupeSql
): NeonCommunicationEventDeduplicator | undefined {
  if (!environment.DATABASE_URL?.trim()) {
    return undefined;
  }

  return new NeonCommunicationEventDeduplicator(environment, sql);
}
