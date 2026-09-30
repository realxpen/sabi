import { z } from "zod";
import {
  communicationChannelSchema,
  communicationResultSchema,
  communicationStatusSchema,
  quoteSchema,
  quoteSourceSchema,
  type CommunicationResult,
  type Quote
} from "../../schemas";

const recordedAtSchema = z.string().datetime();

export const communicationResultAuditRecordSchema = z.object({
  kind: z.literal("COMMUNICATION_RESULT"),
  missionId: z.string().trim().min(1),
  providerId: z.string().trim().min(1),
  communicationId: z.string().trim().min(1),
  partnerEventId: z.string().trim().min(1).optional(),
  partnerExternalId: z.string().trim().min(1).optional(),
  status: communicationStatusSchema,
  sourceChannel: communicationChannelSchema,
  occurredAt: z.string().datetime(),
  recordedAt: recordedAtSchema,
  failureCategory: z.string().trim().min(1).optional(),
  resultSourceReference: z.string().trim().min(1)
});

export const communicationEventAuditRecordSchema = z.object({
  kind: z.enum(["DUPLICATE_EVENT", "UNKNOWN_CORRELATION"]),
  partnerEventId: z.string().trim().min(1),
  recordedAt: recordedAtSchema
});

export const quoteLinkAuditRecordSchema = z.object({
  kind: z.literal("QUOTE_LINK"),
  missionId: z.string().trim().min(1),
  providerId: z.string().trim().min(1),
  communicationId: z.string().trim().min(1),
  quoteId: z.string().trim().min(1),
  quoteSource: quoteSourceSchema,
  quoteSourceReference: z.string().trim().min(1),
  recordedAt: recordedAtSchema
});

export const communicationAuditRecordSchema = z.discriminatedUnion("kind", [
  communicationResultAuditRecordSchema,
  communicationEventAuditRecordSchema.extend({ kind: z.literal("DUPLICATE_EVENT") }),
  communicationEventAuditRecordSchema.extend({ kind: z.literal("UNKNOWN_CORRELATION") }),
  quoteLinkAuditRecordSchema
]);

export type CommunicationAuditRecord = z.infer<
  typeof communicationAuditRecordSchema
>;

export interface CommunicationAuditSink {
  write(record: CommunicationAuditRecord): Promise<void>;
}

/** Test/demo sink only. Production can inject a durable log/telemetry sink. */
export class InMemoryCommunicationAuditSink implements CommunicationAuditSink {
  readonly records: CommunicationAuditRecord[] = [];

  async write(record: CommunicationAuditRecord): Promise<void> {
    this.records.push(communicationAuditRecordSchema.parse(record));
  }
}

function failureCategoryForCommunication(
  communication: CommunicationResult
): string | undefined {
  if (communication.errorCode) {
    return communication.errorCode;
  }

  if (["NO_ANSWER", "UNAVAILABLE", "FAILED"].includes(communication.status)) {
    return communication.status;
  }

  return undefined;
}

/**
 * Build metadata-only observability for a normalized CommunicationResult.
 * Deliberately excludes summaries, observations, transcript content, raw
 * webhook payloads, signatures, auth headers, phone numbers and secrets.
 */
export function buildCommunicationResultAuditRecord(
  candidate: CommunicationResult,
  partnerEventId?: string
): CommunicationAuditRecord {
  const communication = communicationResultSchema.parse(candidate);

  return communicationResultAuditRecordSchema.parse({
    kind: "COMMUNICATION_RESULT",
    missionId: communication.missionId,
    providerId: communication.providerId,
    communicationId: communication.id,
    partnerEventId,
    partnerExternalId: communication.externalId,
    status: communication.status,
    sourceChannel: communication.channel,
    occurredAt: communication.occurredAt,
    recordedAt: new Date().toISOString(),
    failureCategory: failureCategoryForCommunication(communication),
    resultSourceReference: communication.externalId ?? communication.id
  });
}

export function buildCommunicationEventAuditRecord(
  kind: "DUPLICATE_EVENT" | "UNKNOWN_CORRELATION",
  partnerEventId: string
): CommunicationAuditRecord {
  return communicationAuditRecordSchema.parse({
    kind,
    partnerEventId,
    recordedAt: new Date().toISOString()
  });
}

/**
 * Link a Quote back to the communication evidence that produced it.
 * This helper refuses cross-mission/provider links and requires a source
 * reference, preserving the trust model's traceability requirement.
 */
export function buildQuoteLinkAuditRecord(
  communicationCandidate: CommunicationResult,
  quoteCandidate: Quote
): CommunicationAuditRecord {
  const communication = communicationResultSchema.parse(communicationCandidate);
  const quote = quoteSchema.parse(quoteCandidate);

  if (
    quote.missionId !== communication.missionId ||
    quote.providerId !== communication.providerId
  ) {
    throw new Error("Quote/communication audit correlation mismatch");
  }

  if (!quote.sourceReference) {
    throw new Error("Quote audit link requires a source reference");
  }

  return quoteLinkAuditRecordSchema.parse({
    kind: "QUOTE_LINK",
    missionId: quote.missionId,
    providerId: quote.providerId,
    communicationId: communication.id,
    quoteId: quote.id,
    quoteSource: quote.source,
    quoteSourceReference: quote.sourceReference,
    recordedAt: new Date().toISOString()
  });
}
