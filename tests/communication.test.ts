import { describe, expect, it } from "vitest";
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

  it("normalizes a completed mock event into CommunicationResult", async () => {
    const adapter = new MockCommunicationAdapter();
    const occurredAt = new Date().toISOString();

    const result = await adapter.normalizeEvent({
      eventId: "event-123",
      missionId: "mission-demo",
      providerId: "provider-demo",
      status: "completed",
      externalId: "mock-call-123",
      observation: {
        available: true,
        price: 62000,
        deliveryFee: 3000
      },
      occurredAt
    });

    expect(result.id).toBe("mock-event-event-123");
    expect(result.status).toBe("COMPLETED");
    expect(result.channel).toBe("MOCK");
    expect(result.externalId).toBe("mock-call-123");
    expect(result.observation?.price).toBe(62000);
  });

  it("normalizes no-answer without fabricating observations", async () => {
    const adapter = new MockCommunicationAdapter();

    const result = await adapter.normalizeEvent({
      eventId: "event-no-answer",
      missionId: "mission-demo",
      providerId: "provider-demo",
      status: "no_answer",
      occurredAt: new Date().toISOString()
    });

    expect(result.status).toBe("NO_ANSWER");
    expect(result.observation).toBeUndefined();
    expect(result.externalId).toBe("event-no-answer");
    expect(result.summary).toContain("No real provider communication occurred");
  });

  it("rejects quote-like observations on a no-answer event", async () => {
    const adapter = new MockCommunicationAdapter();

    await expect(
      adapter.normalizeEvent({
        eventId: "event-invalid-no-answer",
        missionId: "mission-demo",
        providerId: "provider-demo",
        status: "no_answer",
        observation: {
          price: 62000
        },
        occurredAt: new Date().toISOString()
      })
    ).rejects.toThrow("Only completed mock events may include observations");
  });

  it("rejects malformed external events", async () => {
    const adapter = new MockCommunicationAdapter();

    await expect(
      adapter.normalizeEvent({
        status: "completed"
      })
    ).rejects.toThrow();
  });
});
