import { describe, expect, it } from "vitest";
import {
  NeonCommunicationCorrelationRepository,
  NeonCommunicationCorrelationConfigurationError,
  NeonCommunicationCorrelationError,
  type NeonCommunicationCorrelationSql
} from "../lib/integrations/neon/communication-correlation-repository";

const environment = {
  DATABASE_URL:
    "postgresql://sabi_test:password@example.neon.tech/neondb?sslmode=require"
};

function row(externalId: string | null = null) {
  return {
    communication_id: "communication-sms-1",
    external_id: externalId,
    mission_id: "mission-sms-1",
    provider_id: "provider-tola-fabrics",
    channel: "SMS",
    created_at: "2026-10-01T10:00:00.000Z"
  };
}

describe("Neon communication correlation repository", () => {
  it("fails closed on invalid DATABASE_URL", () => {
    expect(
      () =>
        new NeonCommunicationCorrelationRepository({
          DATABASE_URL: "https://example.com"
        })
    ).toThrow(NeonCommunicationCorrelationConfigurationError);
  });

  it("stores a pending correlation before the external send", async () => {
    const calls: Array<{ text: string; values: unknown[] }> = [];
    const sql = (async (
      strings: TemplateStringsArray,
      ...values: unknown[]
    ) => {
      calls.push({ text: strings.join("?"), values });
      return [row()];
    }) as unknown as NeonCommunicationCorrelationSql;

    const repository = new NeonCommunicationCorrelationRepository(
      environment,
      sql
    );
    const stored = await repository.savePending({
      communicationId: "communication-sms-1",
      missionId: "mission-sms-1",
      providerId: "provider-tola-fabrics",
      channel: "SMS",
      createdAt: "2026-10-01T10:00:00.000Z"
    });

    expect(stored.externalId).toBeUndefined();
    expect(calls[0]?.text).toContain(
      "INSERT INTO communication_correlations"
    );
    expect(calls[0]?.values).toEqual([
      "communication-sms-1",
      "mission-sms-1",
      "provider-tola-fabrics",
      "SMS",
      "2026-10-01T10:00:00.000Z"
    ]);
  });

  it("attaches the external provider message ID durably", async () => {
    const calls: Array<{ text: string; values: unknown[] }> = [];
    const sql = (async (
      strings: TemplateStringsArray,
      ...values: unknown[]
    ) => {
      calls.push({ text: strings.join("?"), values });
      return [row("msg-test-1")];
    }) as unknown as NeonCommunicationCorrelationSql;

    const repository = new NeonCommunicationCorrelationRepository(
      environment,
      sql
    );
    const stored = await repository.attachExternalId(
      "communication-sms-1",
      "msg-test-1"
    );

    expect(stored.externalId).toBe("msg-test-1");
    expect(calls[0]?.text).toContain(
      "UPDATE communication_correlations"
    );
    expect(calls[0]?.values).toEqual([
      "msg-test-1",
      "communication-sms-1",
      "msg-test-1"
    ]);
  });

  it("loads a correlation by external message ID for webhooks", async () => {
    const sql = (async () =>
      [row("msg-test-1")]) as unknown as NeonCommunicationCorrelationSql;
    const repository = new NeonCommunicationCorrelationRepository(
      environment,
      sql
    );

    await expect(
      repository.getByExternalId("msg-test-1")
    ).resolves.toMatchObject({
      communicationId: "communication-sms-1",
      externalId: "msg-test-1",
      missionId: "mission-sms-1",
      providerId: "provider-tola-fabrics"
    });
  });

  it("sanitizes database failures", async () => {
    const sql = (async () => {
      throw new Error(
        "postgresql://private:secret@example.neon.tech/neondb internal"
      );
    }) as unknown as NeonCommunicationCorrelationSql;
    const repository = new NeonCommunicationCorrelationRepository(
      environment,
      sql
    );

    try {
      await repository.getByExternalId("msg-test-1");
      throw new Error("Expected lookup to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(NeonCommunicationCorrelationError);
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain("secret");
      expect(message).not.toContain("internal");
    }
  });
});
