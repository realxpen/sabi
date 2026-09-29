import { describe, expect, it } from "vitest";
import { communicationResultSchema } from "../lib/schemas";
import { MockCommunicationAdapter } from "../lib/integrations/communication/mock";

describe("communication contract", () => {
  it("creates an initiated mock result without claiming completion", async () => {
    const adapter = new MockCommunicationAdapter();

    const result = await adapter.initiateContact({
      missionId: "mission-demo",
      providerId: "provider-demo",
      objective: "Confirm current availability and price."
    });

    expect(result.status).toBe("INITIATED");
    expect(result.channel).toBe("MOCK");
    expect(result.summary).toContain("No real provider was contacted");
  });

  it("rejects malformed external events", () => {
    const result = communicationResultSchema.safeParse({
      status: "COMPLETED"
    });

    expect(result.success).toBe(false);
  });
});
