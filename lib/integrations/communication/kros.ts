import {
  communicationResultSchema,
  type CommunicationResult
} from "../../schemas";
import type {
  CommunicationAdapter,
  ContactProviderInput
} from "./types";

export class KrosTransportConfigurationError extends Error {
  constructor() {
    super(
      "Kros live transport is not configured with a verified driver. Confirm the live base/path, authentication, call lifecycle and account access before enabling it."
    );
    this.name = "KrosTransportConfigurationError";
  }
}

/**
 * Provider-specific live driver seam.
 *
 * The driver owns Kros HTTP/auth/path/event details because the repository
 * still marks those live details as needing account/API-Explorer verification.
 * Do not implement a driver from guesses or model memory.
 */
export interface KrosTransportDriver {
  initiateContact(input: ContactProviderInput): Promise<unknown>;
  normalizeEvent(payload: unknown): Promise<unknown>;
}

/**
 * Kros implementation of SABI's existing CommunicationAdapter contract.
 *
 * Constructing this adapter without a verified driver is intentionally allowed
 * so configuration can fail closed at runtime rather than silently falling
 * back to guessed endpoints.
 */
export class KrosCommunicationAdapter implements CommunicationAdapter {
  readonly name = "krosai";

  constructor(private readonly driver?: KrosTransportDriver) {}

  private requireDriver(): KrosTransportDriver {
    if (!this.driver) {
      throw new KrosTransportConfigurationError();
    }

    return this.driver;
  }

  async initiateContact(
    input: ContactProviderInput
  ): Promise<CommunicationResult> {
    const result = communicationResultSchema.parse(
      await this.requireDriver().initiateContact(input)
    );

    if (
      result.missionId !== input.missionId ||
      result.providerId !== input.providerId
    ) {
      throw new Error("Kros transport returned mismatched correlation fields");
    }

    return result;
  }

  async normalizeEvent(payload: unknown): Promise<CommunicationResult> {
    return communicationResultSchema.parse(
      await this.requireDriver().normalizeEvent(payload)
    );
  }
}
