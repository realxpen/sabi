import { describe, expect, it } from "vitest";
import { normalizeRelativeDeadline } from "../app/api/agent-tools/compare-quotes/route";

describe("compare quotes deadline normalization", () => {
  it("resolves tomorrow from the persisted mission creation time", () => {
    expect(
      normalizeRelativeDeadline("tomorrow", "2026-10-03T00:21:00.000Z")
    ).toBe("2026-10-04");
  });

  it("leaves an already absolute deadline unchanged", () => {
    expect(
      normalizeRelativeDeadline("2026-10-04", "2026-10-03T00:21:00.000Z")
    ).toBe("2026-10-04");
  });
});
