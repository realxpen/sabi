import { describe, expect, it } from "vitest";
import { approvalSchema } from "../lib/schemas";
import {
  createNeonApprovalRepositoryFromEnvironment,
  NeonApprovalRepository,
  NeonApprovalRepositoryConfigurationError,
  NeonApprovalRepositoryError,
  type NeonApprovalSql
} from "../lib/integrations/neon/approval-repository";

const environment = {
  DATABASE_URL:
    "postgresql://sabi_test:password@example.neon.tech/neondb?sslmode=require"
};

const approval = approvalSchema.parse({
  id: "approval-test-1",
  missionId: "mission-test-1",
  action: "SELECT_PROVIDER",
  providerId: "provider-ade-textiles",
  quoteId: "quote-test-1",
  status: "PENDING",
  createdAt: "2026-09-30T20:00:00.000Z"
});

function storageRow() {
  return {
    id: approval.id,
    mission_id: approval.missionId,
    action: approval.action,
    provider_id: approval.providerId,
    quote_id: approval.quoteId,
    status: approval.status,
    created_at: approval.createdAt
  };
}

function createSqlMock(result: unknown) {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const sql = (async (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => {
    calls.push({ text: strings.join("?"), values });
    return result;
  }) as unknown as NeonApprovalSql;

  return { sql, calls };
}

describe("Neon Approval repository", () => {
  it("fails closed when DATABASE_URL is not PostgreSQL", () => {
    expect(
      () => new NeonApprovalRepository({ DATABASE_URL: "https://example.com" })
    ).toThrow(NeonApprovalRepositoryConfigurationError);
  });

  it("returns undefined when no Neon database configuration exists", () => {
    expect(createNeonApprovalRepositoryFromEnvironment({})).toBeUndefined();
  });

  it("stores canonical pending Approvals with parameterized Neon SQL", async () => {
    const { sql, calls } = createSqlMock([storageRow()]);
    const repository = new NeonApprovalRepository(environment, sql);
    const stored = await repository.save(approval);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.text).toContain("INSERT INTO approvals");
    expect(calls[0]?.text).toContain("RETURNING");
    expect(calls[0]?.values).toEqual([
      approval.id,
      approval.missionId,
      "SELECT_PROVIDER",
      approval.providerId,
      approval.quoteId,
      "PENDING",
      approval.createdAt
    ]);
    expect(stored).toEqual(approval);
  });

  it("loads one stored Approval", async () => {
    const { sql, calls } = createSqlMock([storageRow()]);
    const repository = new NeonApprovalRepository(environment, sql);
    const stored = await repository.getById("approval-test-1");

    expect(calls).toHaveLength(1);
    expect(calls[0]?.text).toContain("FROM approvals");
    expect(calls[0]?.text).toContain("WHERE id = ?");
    expect(calls[0]?.values).toEqual(["approval-test-1"]);
    expect(stored).toEqual(approval);
  });

  it("returns undefined when an Approval is not found", async () => {
    const { sql } = createSqlMock([]);
    const repository = new NeonApprovalRepository(environment, sql);

    await expect(repository.getById("approval-missing")).resolves.toBeUndefined();
  });

  it("does not leak database errors or connection secrets", async () => {
    const sql = (async () => {
      throw new Error(
        "postgresql://private-user:private-password@example.neon.tech/neondb internal approval row"
      );
    }) as unknown as NeonApprovalSql;
    const repository = new NeonApprovalRepository(environment, sql);

    try {
      await repository.save(approval);
      throw new Error("Expected save to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(NeonApprovalRepositoryError);
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toBe("Neon Approval persistence query failed.");
      expect(message).not.toContain("private-password");
      expect(message).not.toContain("internal approval row");
    }
  });
});
