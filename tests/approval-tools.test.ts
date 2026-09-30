import { describe, expect, it } from "vitest";
import { requestApproval } from "../lib/tools/approval-tools";
import { recordQuote } from "../lib/tools/quote-tools";

describe("requestApproval", () => {
  it("creates a pending approval for a matching quote", () => {
    const quote = recordQuote({
      missionId: "mission-demo",
      providerId: "provider-tola-fabrics",
      available: true,
      price: 64000,
      source: "CALL",
      sourceReference: "communication-call-3"
    });

    const approval = requestApproval(
      {
        missionId: quote.missionId,
        providerId: quote.providerId,
        quoteId: quote.id
      },
      (quoteId) => (quoteId === quote.id ? quote : undefined)
    );

    expect(approval.status).toBe("PENDING");
    expect(approval.action).toBe("SELECT_PROVIDER");
    expect(approval.quoteId).toBe(quote.id);
    expect(approval.providerId).toBe(quote.providerId);
  });

  it("rejects a missing quote", () => {
    expect(() =>
      requestApproval(
        {
          missionId: "mission-demo",
          providerId: "provider-tola-fabrics",
          quoteId: "quote-missing"
        },
        () => undefined
      )
    ).toThrow("Quote not found");
  });

  it("rejects a quote from a different mission", () => {
    const quote = recordQuote({
      missionId: "mission-other",
      providerId: "provider-tola-fabrics",
      available: true,
      price: 64000,
      source: "MANUAL"
    });

    expect(() =>
      requestApproval(
        {
          missionId: "mission-demo",
          providerId: quote.providerId,
          quoteId: quote.id
        },
        () => quote
      )
    ).toThrow("requested mission");
  });

  it("rejects a quote from a different provider", () => {
    const quote = recordQuote({
      missionId: "mission-demo",
      providerId: "provider-mariam-fabrics",
      available: true,
      price: 61000,
      source: "MANUAL"
    });

    expect(() =>
      requestApproval(
        {
          missionId: quote.missionId,
          providerId: "provider-tola-fabrics",
          quoteId: quote.id
        },
        () => quote
      )
    ).toThrow("requested provider");
  });
});
