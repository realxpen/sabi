import { describe, expect, it } from "vitest";
import {
  KrosCommunicationAdapter,
  KrosTransportConfigurationError
} from "../lib/integrations/communication/kros";

describe("KrosCommunicationAdapter", () => {
  it("fails closed when no verified live driver is configured", async () => {
    const adapter = new KrosCommunicationAdapter();

    await expect(
      adapter.initiateContact({
        missionId: "mission-demo",
        providerId: "provider-tola-fabrics",
        objective: "Confirm availability."
      })
    ).rejects.toBeInstanceOf(KrosTransportConfigurationError);
  });

  it("accepts a validated driver result through the shared adapter contract", async () => {
    const adapter = new KrosCommunicationAdapter({
      async initiateContact(input) {
        return {
          id: "communication-kros-1",
          missionId: input.missionId,
          providerId: input.providerId,
          channel: "CALL",
          status: "INITIATED",
          externalId: "test-external-call-id",
          occurredAt: "2026-09-30T12:00:00.000Z"
        };
      },
      async normalizeEvent(payload) {
        return payload;
      }
    });

    const result = await adapter.initiateContact({
      missionId: "mission-demo",
      providerId: "provider-tola-fabrics",
      objective: "Confirm availability."
    });

    expect(result.status).toBe("INITIATED");
    expect(result.channel).toBe("CALL");
    expect(result.externalId).toBe("test-external-call-id");
  });

  it("rejects a driver initiation result with mismatched correlation", async () => {
    const adapter = new KrosCommunicationAdapter({
      async initiateContact() {
        return {
          id: "communication-kros-mismatch",
          missionId: "different-mission",
          providerId: "provider-tola-fabrics",
          channel: "CALL",
          status: "INITIATED",
          occurredAt: "2026-09-30T12:00:00.000Z"
        };
      },
      async normalizeEvent(payload) {
        return payload;
      }
    });

    await expect(
      adapter.initiateContact({
        missionId: "mission-demo",
        providerId: "provider-tola-fabrics",
        objective: "Confirm availability."
      })
    ).rejects.toThrow("mismatched correlation fields");
  });

  it("validates normalized event output from an injected driver", async () => {
    const adapter = new KrosCommunicationAdapter({
      async initiateContact(input) {
        return {
          id: "communication-kros-2",
          missionId: input.missionId,
          providerId: input.providerId,
          channel: "CALL",
          status: "INITIATED",
          occurredAt: "2026-09-30T12:00:00.000Z"
        };
      },
      async normalizeEvent() {
        return {
          id: "communication-kros-2",
          missionId: "mission-demo",
          providerId: "provider-tola-fabrics",
          channel: "CALL",
          status: "NO_ANSWER",
          externalId: "test-external-call-id",
          occurredAt: "2026-09-30T12:05:00.000Z"
        };
      }
    });

    const result = await adapter.normalizeEvent({ test: true });

    expect(result.status).toBe("NO_ANSWER");
    expect(result.observation).toBeUndefined();
  });
});
