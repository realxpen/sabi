import { describe, expect, it } from "vitest";
import { callProvider } from "../lib/tools/provider-tools";
import { initiateContactWithRecovery } from "../lib/integrations/communication/recovery";
import { MockCommunicationAdapter } from "../lib/integrations/communication/mock";
import type { CommunicationAdapter } from "../lib/integrations/communication/types";

const failingAdapter: CommunicationAdapter = {
  name: "failing-test-adapter",
  async initiateContact() {
    throw new Error("provider network secret/details must not leak");
  },
  async normalizeEvent() {
    throw new Error("not used");
  }
};

describe("communication failure recovery", () => {
  it("normalizes a transport exception to FAILED without evidence", async () => {
    const result = await initiateContactWithRecovery({
      contact: {
        missionId: "mission-demo",
        providerId: "provider-tola-fabrics",
        objective: "Confirm availability."
      },
      adapter: failingAdapter,
      failureChannel: "CALL"
    });

    expect(result.status).toBe("FAILED");
    expect(result.channel).toBe("CALL");
    expect(result.errorCode).toBe("COMMUNICATION_INITIATION_FAILED");
    expect(result.observation).toBeUndefined();
    expect(result.summary).not.toContain("network secret");
  });

  it("keeps callProvider bounded when its adapter fails", async () => {
    const result = await callProvider(
      {
        missionId: "mission-demo",
        providerId: "provider-tola-fabrics",
        objective: "Confirm availability."
      },
      failingAdapter
    );

    expect(result.status).toBe("FAILED");
    expect(result.providerId).toBe("provider-tola-fabrics");
    expect(result.observation).toBeUndefined();
  });

  it("normalizes busy as NO_ANSWER with no fabricated observation", async () => {
    const adapter = new MockCommunicationAdapter();
    const result = await adapter.normalizeEvent({
      eventId: "event-busy",
      missionId: "mission-demo",
      providerId: "provider-tola-fabrics",
      status: "busy",
      occurredAt: "2026-09-30T12:00:00.000Z"
    });

    expect(result.status).toBe("NO_ANSWER");
    expect(result.observation).toBeUndefined();
  });

  it("keeps delayed/in-progress communication non-terminal and quote-less", async () => {
    const adapter = new MockCommunicationAdapter();
    const result = await adapter.normalizeEvent({
      eventId: "event-delayed",
      missionId: "mission-demo",
      providerId: "provider-tola-fabrics",
      status: "in_progress",
      occurredAt: "2026-09-30T12:00:00.000Z"
    });

    expect(result.status).toBe("IN_PROGRESS");
    expect(result.observation).toBeUndefined();
  });

  it("keeps provider-unavailable communication quote-less", async () => {
    const adapter = new MockCommunicationAdapter();
    const result = await adapter.normalizeEvent({
      eventId: "event-unavailable",
      missionId: "mission-demo",
      providerId: "provider-tola-fabrics",
      status: "unavailable",
      occurredAt: "2026-09-30T12:00:00.000Z"
    });

    expect(result.status).toBe("UNAVAILABLE");
    expect(result.observation).toBeUndefined();
  });
});
