import { z } from "zod";
import {
  communicationObservationSchema,
  communicationResultSchema,
  type CommunicationObservation
} from "../schemas";
import {
  getMissionSnapshot,
  saveMissionSnapshot
} from "../integrations/neon/mission-snapshot-repository";
import { quoteFromCommunicationEvidence } from "./quote-evidence";
import { advanceMissionOrchestration } from "./orchestrator";

export const structuredCommunicationEvidenceInputSchema = z.object({
  communicationId: z.string().trim().min(1),
  observation: communicationObservationSchema.extend({
    available: z.boolean()
  })
});

export type StructuredCommunicationEvidenceInput = z.infer<
  typeof structuredCommunicationEvidenceInputSchema
>;

/**
 * Attach factual structured observations to an existing completed provider
 * communication, then reconcile the resulting Quote and deterministic
 * recommendation as far as the safe non-consequential pipeline allows.
 *
 * This API does not parse transcripts. The caller must supply explicit factual
 * fields and preserve unknowns by omitting them. It cannot turn NO_ANSWER,
 * FAILED, INITIATED or IN_PROGRESS communication into a Quote.
 */
export async function recordStructuredCommunicationEvidence(
  missionId: string,
  input: StructuredCommunicationEvidenceInput
) {
  const parsed = structuredCommunicationEvidenceInputSchema.parse(input);
  const snapshot = await getMissionSnapshot(missionId);

  if (!snapshot) throw new Error("MISSION_NOT_FOUND");

  const index = snapshot.communications.findIndex(
    (communication) => communication.id === parsed.communicationId
  );

  if (index === -1) throw new Error("COMMUNICATION_NOT_FOUND");

  const current = snapshot.communications[index];

  if (current.missionId !== missionId) {
    throw new Error("COMMUNICATION_MISSION_MISMATCH");
  }

  if (current.status !== "COMPLETED") {
    throw new Error("COMMUNICATION_NOT_COMPLETED");
  }

  const observation: CommunicationObservation =
    communicationObservationSchema.parse(parsed.observation);

  const communication = communicationResultSchema.parse({
    ...current,
    observation
  });

  const communications = snapshot.communications.map((candidate, candidateIndex) =>
    candidateIndex === index ? communication : candidate
  );

  const quote = quoteFromCommunicationEvidence(communication);
  if (!quote) throw new Error("QUOTE_EVIDENCE_INCOMPLETE");

  const quoteIndex = snapshot.quotes.findIndex(
    (candidate) => candidate.id === quote.id
  );
  const quotes =
    quoteIndex === -1
      ? [...snapshot.quotes, quote]
      : snapshot.quotes.map((candidate, candidateIndex) =>
          candidateIndex === quoteIndex ? quote : candidate
        );

  let updated = await saveMissionSnapshot({
    ...snapshot,
    communications,
    quotes
  });

  // Only continue through stages that cannot trigger a new external action.
  // COLLECTING_QUOTES -> COMPARING and COMPARING -> AWAITING_APPROVAL are safe.
  while (
    updated.mission.status === "COLLECTING_QUOTES" ||
    updated.mission.status === "COMPARING"
  ) {
    const next = await advanceMissionOrchestration(missionId, {
      mode: updated.demoMode ? "SIMULATION" : "LIVE"
    });
    updated = next.snapshot;
    if (next.outcome === "WAITING" || next.outcome === "CHECKPOINT") break;
  }

  return {
    snapshot: updated,
    communication,
    quote
  };
}
