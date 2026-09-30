import { describe, expect, it } from "vitest";
import { quoteSchema } from "../lib/schemas";
import {
  createNeonQuoteRepositoryFromEnvironment,
  NeonQuoteRepository,
  NeonQuoteRepositoryConfigurationError,
  NeonQuoteRepositoryError,
  type NeonSql
} from "../lib/integrations/neon/quote-repository";

const environment = {
  DATABASE_URL:
    "postgresql://sabi_test:password@example.neon.tech/neondb?sslmode=require"
};

const quote = quoteSchema.parse({
  id: "quote-test-1",
  missionId: "mission-test-1",
  providerId: "provider-ade-textiles",
  available: true,
  price: 62000,
  source: "CALL",
  sourceReference: "communication-test-1",
  createdAt: "2026-09-30T20:00:00.000Z"
});

function storageRow() {
  return {
    id: quote.id,
    mission_id: quote.missionId,
    provider_id: quote.providerId,
    available: true,
    price: "62000",
    delivery_fee: null,
    total: null,
    delivery_date: null,
    notes: null,
    source: "CALL",
    source_reference: "communication-test-1",
    created_at: quote.createdAt
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
  }) as unknown as NeonSql;

  return { sql, calls };
}

describe("Neon Quote repository", () => {
  it("fails closed when DATABASE_URL is not PostgreSQL", () => {
    expect(
      () => new NeonQuoteRepository({ DATABASE_URL: "https://example.com" })
    ).toThrow(NeonQuoteRepositoryConfigurationError);
  });

  it("returns undefined when no Neon database configuration exists", () => {
    expect(createNeonQuoteRepositoryFromEnvironment({})).toBeUndefined();
  });

  it("stores canonical Quotes with parameterized Neon SQL", async () => {
    const { sql, calls } = createSqlMock([storageRow()]);
    const repository = new NeonQuoteRepository(environment, sql);
    const stored = await repository.save(quote);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.text).toContain("INSERT INTO quotes");
    expect(calls[0]?.text).toContain("RETURNING");
    expect(calls[0]?.values).toEqual([
      quote.id,
      quote.missionId,
      quote.providerId,
      true,
      62000,
      null,
      null,
      null,
      null,
      "CALL",
      "communication-test-1",
      quote.createdAt
    ]);
    expect(stored).toEqual(quote);
    expect(stored.deliveryFee).toBeUndefined();
    expect(stored.total).toBeUndefined();
  });

  it("loads one stored Quote and maps nullable Postgres fields back to unknown", async () => {
    const { sql, calls } = createSqlMock([storageRow()]);
    const repository = new NeonQuoteRepository(environment, sql);
    const stored = await repository.getById("quote-test-1");

    expect(calls).toHaveLength(1);
    expect(calls[0]?.text).toContain("FROM quotes");
    expect(calls[0]?.text).toContain("WHERE id = ?");
    expect(calls[0]?.values).toEqual(["quote-test-1"]);
    expect(stored).toEqual(quote);
  });

  it("returns undefined when a Quote is not found", async () => {
    const { sql } = createSqlMock([]);
    const repository = new NeonQuoteRepository(environment, sql);

    await expect(repository.getById("quote-missing")).resolves.toBeUndefined();
  });

  it("does not leak database errors or connection secrets", async () => {
    const sql = (async () => {
      throw new Error(
        "postgresql://private-user:private-password@example.neon.tech/neondb internal row details"
      );
    }) as unknown as NeonSql;
    const repository = new NeonQuoteRepository(environment, sql);

    try {
      await repository.save(quote);
      throw new Error("Expected save to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(NeonQuoteRepositoryError);
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toBe("Neon Quote persistence query failed.");
      expect(message).not.toContain("private-password");
      expect(message).not.toContain("internal row details");
    }
  });
});
