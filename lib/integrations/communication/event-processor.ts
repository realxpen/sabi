import { z } from "zod";
import type { CommunicationResult } from "../../schemas";
import type { CommunicationAdapter } from "./types";
import {
  buildCommunicationEventAuditRecord,
  buildCommunicationResultAuditRecord,
  type CommunicationAuditSink
} from "./observability";

const eventIdSchema = z.string().trim().min(1);

export type CommunicationCorrelation = {
  missionId: string;
  providerId: string;
};

export interface CommunicationEventDeduplicator {
  claim(eventId: string): Promise<boolean>;
  release(eventId: string): Promise<void>;
}

export class InMemoryCommunicationEventDeduplicator
  implements CommunicationEventDeduplicator
{
  private readonly claimedEventIds = new Set<string>();

  async claim(eventId: string): Promise<boolean> {
    if (this.claimedEventIds.has(eventId)) return false;
    this.claimedEventIds.add(eventId);
    return true;
  }

  async release(eventId: string): Promise<void> {
    this.claimedEventIds.delete(eventId);
  }
}

export type ProcessCommunicationEventResult =
  | { kind: "PROCESSED"; eventId: string; communication: CommunicationResult }
  | { kind: "DUPLICATE"; eventId: string }
  | { kind: "UNKNOWN_CORRELATION"; eventId: string };

export type ProcessCommunicationEventInput = {
  eventId: string;
  payload: unknown;
  adapter: CommunicationAdapter;
  correlation?: CommunicationCorrelation;
  deduplicator: CommunicationEventDeduplicator;
  auditSink?: CommunicationAuditSink;
  onProcessed?: (communication: CommunicationResult) => Promise<void>;
};

async function writeAuditBestEffort(
  sink: CommunicationAuditSink | undefined,
  record: Parameters<CommunicationAuditSink["write"]>[0]
): Promise<void> {
  if (!sink) return;
  try {
    await sink.write(record);
  } catch {
    // Telemetry failure must not change communication truth or retry semantics.
  }
}

/**
 * Provider-neutral communication event processor.
 *
 * The optional onProcessed hook is deliberately inside the dedupe claim's
 * transactional boundary: if mission persistence fails, the claim is released
 * so a provider retry can safely attempt the update again. A processed event is
 * only left claimed after normalization, correlation checks and persistence all
 * succeed.
 */
export async function processCommunicationEvent(
  input: ProcessCommunicationEventInput
): Promise<ProcessCommunicationEventResult> {
  const eventId = eventIdSchema.parse(input.eventId);

  if (!input.correlation) {
    await writeAuditBestEffort(
      input.auditSink,
      buildCommunicationEventAuditRecord("UNKNOWN_CORRELATION", eventId)
    );
    return { kind: "UNKNOWN_CORRELATION", eventId };
  }

  const claimed = await input.deduplicator.claim(eventId);
  if (!claimed) {
    await writeAuditBestEffort(
      input.auditSink,
      buildCommunicationEventAuditRecord("DUPLICATE_EVENT", eventId)
    );
    return { kind: "DUPLICATE", eventId };
  }

  try {
    const communication = await input.adapter.normalizeEvent(input.payload);

    if (
      communication.missionId !== input.correlation.missionId ||
      communication.providerId !== input.correlation.providerId
    ) {
      throw new Error(`Communication correlation mismatch for event ${eventId}.`);
    }

    await input.onProcessed?.(communication);

    await writeAuditBestEffort(
      input.auditSink,
      buildCommunicationResultAuditRecord(communication, eventId)
    );

    return { kind: "PROCESSED", eventId, communication };
  } catch (error) {
    await input.deduplicator.release(eventId);
    throw error;
  }
}
