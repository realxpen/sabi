import { z } from "zod";
import type { CommunicationResult } from "../../schemas";
import {
  persistCommunicationIntelligence,
  type MissionSnapshotStore,
  type PersistCommunicationIntelligenceResult
} from "../../mission/communication-intelligence-persistence";

const verifiedVapiTranscriptPayloadSchema = z
  .object({
    message: z
      .object({
        artifact: z
          .object({ transcript: z.string().optional() })
          .passthrough()
          .optional(),
        transcript: z.string().optional()
      })
      .passthrough()
  })
  .passthrough();

export type PersistVerifiedVapiEventInput = {
  payload: unknown;
  communication: CommunicationResult;
  store?: MissionSnapshotStore;
};

/**
 * Extract transcript evidence only after the caller has completed Lara's Vapi
 * webhook authentication, call verification, correlation and deduplication.
 * This helper performs no authenticity checks itself.
 */
export function extractVerifiedVapiTranscript(
  payload: unknown
): string | undefined {
  const parsed = verifiedVapiTranscriptPayloadSchema.safeParse(payload);
  if (!parsed.success) return undefined;

  const transcript =
    parsed.data.message.artifact?.transcript ?? parsed.data.message.transcript;

  return transcript?.trim() ? transcript : undefined;
}

/**
 * Production integration callback for Lara's already-verified Vapi event.
 */
export function persistVerifiedVapiEventIntelligence({
  payload,
  communication,
  store
}: PersistVerifiedVapiEventInput): Promise<PersistCommunicationIntelligenceResult> {
  return persistCommunicationIntelligence({
    communication,
    transcript: extractVerifiedVapiTranscript(payload),
    store
  });
}
