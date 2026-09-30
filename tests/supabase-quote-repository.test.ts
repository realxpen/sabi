import { describe, expect, it } from "vitest";
import { quoteSchema } from "../lib/schemas";
import {
  createSupabaseQuoteRepositoryFromEnvironment,
  SupabaseQuoteRepository,
  SupabaseQuoteRepositoryConfigurationError,
  SupabaseQuoteRepositoryError
} from "../lib/integrations/supabase/quote-repository";

const environment = {
  SUPABASE_URL: "https://sabi-test.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_test_only"
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
    price: 62000,
    delivery_fee: null,
    total: null,
    delivery_date: null,
    notes: null,
    source: "CALL",
    source_reference: "communication-test-1",
    created_at: quote.createdAt
  };
}

describe("Supabase Quote repository", () => {
  it("fails closed on partial durable-storage configuration", () => {
    expect(
      () =>
        new SupabaseQuoteRepository({
          SUPABASE_URL: environment.SUPABASE_URL
        })
    ).toThrow(SupabaseQuoteRepositoryConfigurationError);
  });

  it("returns undefined when no Supabase configuration exists", () => {
    expect(createSupabaseQuoteRepositoryFromEnvironment({})).toBeUndefined();
  });

  it("stores canonical Quotes through the documented Supabase REST surface", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    const fetchImpl = (async (input: URL | RequestInfo, init?: RequestInit) => {
      capturedUrl = input.toString();
      capturedInit = init;
      return new Response(JSON.stringify([storageRow()]), {
        status: 201,
        headers: { "content-type": "application/json" }
      });
    }) as typeof fetch;

    const repository = new SupabaseQuoteRepository(environment, fetchImpl);
    const stored = await repository.save(quote);

    expect(capturedUrl).toBe(
      "https://sabi-test.supabase.co/rest/v1/quotes"
    );
    expect(capturedInit?.method).toBe("POST");
    expect(capturedInit?.headers).toMatchObject({
      apikey: "sb_secret_test_only",
      authorization: "Bearer sb_secret_test_only",
      "content-type": "application/json",
      prefer: "return=representation"
    });
    expect(JSON.parse(String(capturedInit?.body))).toEqual(storageRow());
    expect(stored).toEqual(quote);
    expect(stored.deliveryFee).toBeUndefined();
    expect(stored.total).toBeUndefined();
  });

  it("loads one stored Quote and maps nullable storage fields back to unknown", async () => {
    let capturedUrl = "";

    const fetchImpl = (async (input: URL | RequestInfo) => {
      capturedUrl = input.toString();
      return new Response(JSON.stringify([storageRow()]), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }) as typeof fetch;

    const repository = new SupabaseQuoteRepository(environment, fetchImpl);
    const stored = await repository.getById("quote-test-1");
    const url = new URL(capturedUrl);

    expect(url.pathname).toBe("/rest/v1/quotes");
    expect(url.searchParams.get("id")).toBe("eq.quote-test-1");
    expect(url.searchParams.get("select")).toBe("*");
    expect(url.searchParams.get("limit")).toBe("1");
    expect(stored).toEqual(quote);
  });

  it("returns undefined when the Quote is not found", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" }
      })) as typeof fetch;

    const repository = new SupabaseQuoteRepository(environment, fetchImpl);
    await expect(repository.getById("quote-missing")).resolves.toBeUndefined();
  });

  it("does not leak provider response bodies or secret keys in storage errors", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          message: "database says sb_secret_test_only and private row details"
        }),
        { status: 500, headers: { "content-type": "application/json" } }
      )) as typeof fetch;

    const repository = new SupabaseQuoteRepository(environment, fetchImpl);

    try {
      await repository.save(quote);
      throw new Error("Expected save to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(SupabaseQuoteRepositoryError);
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain("status 500");
      expect(message).not.toContain("sb_secret_test_only");
      expect(message).not.toContain("private row details");
    }
  });
});
