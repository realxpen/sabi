import { z } from "zod";
import type { CommunicationResult } from "../../schemas";
import type { CommunicationAdapter } from "./types";

const eventIdSchema = z.string().trim().min(1);

export type CommunicationCorrelation = {
  missionId: string;
  providerId: string;
};

export interface CommunicationEventDeduplicator {
  claim(eventId: string): Promise<boolean>;
  release(eventId: string): Promise<void>;
}

/**
 * Test/demo deduplicator only.
 * Production webhook handlers should inject durable storage rather than
 * relying on process memory.
 */
export class InMemoryCommunicationEventDeduplicator
  implements CommunicationEventDeduplicator
{
  private readonly claimedEventIds = new Set<string>();

  async claim(eventId: string): Promise<boolean> {
    if (this.claimedEventIds.has(eventId)) {
      return false;
    }

    this.claimedEventIds.add(eventId);
    return true;
  }

  async release(eventId: string): Promise<void> {
    this.claimedEventIds.delete(eventId);
  }
}

export type ProcessCommunicationEventResult =
  | {
      kind: "PROCESSED";
      eventId: string;
      communication: CommunicationResult;
    }
  | {
      kind: "DUPLICATE";
      eventId: string;
    }
  | {
      kind: "UNKNOWN_CORRELATION";
      eventId: string;
    };

export type ProcessCommunicationEventInput = {
  eventId: string;
  payload: unknown;
  adapter: CommunicationAdapter;
  correlation?: CommunicationCorrelation;
  deduplicator: CommunicationEventDeduplicator;
};

/**
 * Provider-neutral event processing seam.
 *
 * Provider-specific authentication/signature verification and correlation
 * lookup must happen before this function. This function then performs
 * idempotency, normalization, and a defensive correlation match.
 */
export async function processCommunicationEvent(
  input: ProcessCommunicationEventInput
): Promise<ProcessCommunicationEventResult> {
  const eventId = eventIdSchema.parse(input.eventId);

  if (!input.correlation) {
    return {
      kind: "UNKNOWN_CORRELATION",
      eventId
    };
  }

  const claimed = await input.deduplicator.claim(eventId);

  if (!claimed) {
    return {
      kind: "DUPLICATE",
      eventId
    };
  }

  try {
    const communication = await input.adapter.normalizeEvent(input.payload);

    if (
      communication.missionId !== input.correlation.missionId ||
      communication.providerId !== input.correlation.providerId
    ) {
      throw new Error(
        `Communication correlation mismatch for event ${eventId}.`
      );
    }

    return {
      kind: "PROCESSED",
      eventId,
      communication
    };
  } catch (error) {
    await input.deduplicator.release(eventId);
    throw error;
  }
}
