import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import {
  approvalSchema,
  approvalStatusSchema,
  type Approval
} from "../../schemas";
import {
  type ApprovalRepository,
  validateStoredApproval
} from "../../repositories/approval-repository";

const neonApprovalRepositoryEnvironmentSchema = z.object({
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

export type NeonApprovalRepositoryEnvironmentInput = {
  [key: string]: string | undefined;
};

export type NeonApprovalSql = ReturnType<typeof neon>;

const storedTimestampSchema = z
  .union([z.string().datetime(), z.date()])
  .transform((value) => (value instanceof Date ? value.toISOString() : value));

const neonApprovalRowSchema = z.object({
  id: z.string().min(1),
  mission_id: z.string().min(1),
  action: z.literal("SELECT_PROVIDER"),
  provider_id: z.string().min(1),
  quote_id: z.string().min(1),
  status: approvalStatusSchema,
  created_at: storedTimestampSchema
});

export class NeonApprovalRepositoryConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NeonApprovalRepositoryConfigurationError";
  }
}

export class NeonApprovalRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NeonApprovalRepositoryError";
  }
}

function fromStorageRow(row: unknown): Approval {
  const stored = neonApprovalRowSchema.parse(row);

  return validateStoredApproval({
    id: stored.id,
    missionId: stored.mission_id,
    action: stored.action,
    providerId: stored.provider_id,
    quoteId: stored.quote_id,
    status: stored.status,
    createdAt: stored.created_at
  });
}

function firstStoredApproval(
  rows: unknown,
  operation: string
): Approval | undefined {
  try {
    const parsedRows = z.array(neonApprovalRowSchema).parse(rows);
    return parsedRows[0] ? fromStorageRow(parsedRows[0]) : undefined;
  } catch {
    throw new NeonApprovalRepositoryError(
      `Neon returned an invalid Approval row during ${operation}.`
    );
  }
}

export class NeonApprovalRepository implements ApprovalRepository {
  private readonly sql: NeonApprovalSql;

  constructor(
    environment: NeonApprovalRepositoryEnvironmentInput,
    sql?: NeonApprovalSql
  ) {
    const parsed = neonApprovalRepositoryEnvironmentSchema.safeParse(environment);

    if (!parsed.success) {
      throw new NeonApprovalRepositoryConfigurationError(
        "DATABASE_URL is required for durable Neon Approval persistence."
      );
    }

    this.sql = sql ?? neon(parsed.data.DATABASE_URL);
  }

  async save(candidate: Approval): Promise<Approval> {
    const approval = approvalSchema.parse(candidate);

    let rows: unknown;
    try {
      rows = await this.sql`
        INSERT INTO approvals (
          id,
          mission_id,
          action,
          provider_id,
          quote_id,
          status,
          created_at
        ) VALUES (
          ${approval.id},
          ${approval.missionId},
          ${approval.action},
          ${approval.providerId},
          ${approval.quoteId},
          ${approval.status},
          ${approval.createdAt}
        )
        RETURNING
          id,
          mission_id,
          action,
          provider_id,
          quote_id,
          status,
          created_at
      `;
    } catch {
      throw new NeonApprovalRepositoryError(
        "Neon Approval persistence query failed."
      );
    }

    const stored = firstStoredApproval(rows, "persistence");

    if (!stored) {
      throw new NeonApprovalRepositoryError(
        "Neon Approval persistence returned no stored Approval."
      );
    }

    return stored;
  }

  async getById(approvalId: string): Promise<Approval | undefined> {
    const id = z.string().trim().min(1).parse(approvalId);

    let rows: unknown;
    try {
      rows = await this.sql`
        SELECT
          id,
          mission_id,
          action,
          provider_id,
          quote_id,
          status,
          created_at
        FROM approvals
        WHERE id = ${id}
        LIMIT 1
      `;
    } catch {
      throw new NeonApprovalRepositoryError("Neon Approval lookup query failed.");
    }

    return firstStoredApproval(rows, "lookup");
  }
}

export function createNeonApprovalRepositoryFromEnvironment(
  environment: NeonApprovalRepositoryEnvironmentInput = process.env,
  sql?: NeonApprovalSql
): NeonApprovalRepository | undefined {
  if (!environment.DATABASE_URL?.trim()) {
    return undefined;
  }

  return new NeonApprovalRepository(environment, sql);
}
