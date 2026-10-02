import { z } from "zod";
import {
  BimpeAIConfigurationError,
  BimpeAIRequestError,
  fromBimpeExternalId,
  getBimpeCallDetail,
  type BimpeAIEnvironment,
  type BimpeAIFetch
} from "../communication/bimpe-ai";

const transcriptEntrySchema = z
  .object({
    role: z.string().optional(),
    speaker: z.string().optional(),
    content: z.string().optional(),
    message: z.string().optional(),
    text: z.string().optional()
  })
  .passthrough();

export class BimpeEvidenceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BimpeEvidenceUnavailableError";
  }
}

function normalizeTranscript(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();

  const entries = z.array(transcriptEntrySchema).safeParse(value);
  if (!entries.success) return undefined;

  const lines = entries.data
    .map((entry) => {
      const text =
        entry.message?.trim() ||
        entry.content?.trim() ||
        entry.text?.trim();
      if (!text) return undefined;
      const speaker = entry.role?.trim() || entry.speaker?.trim() || "speaker";
      return `${speaker}: ${text}`;
    })
    .filter((line): line is string => Boolean(line));

  return lines.length ? lines.join("\n") : undefined;
}

/**
 * Read one BimpeAI call transcript as evidence only.
 *
 * The returned transcript is never written into Mission state by this helper,
 * and no Quote or structured observation is inferred from it automatically.
 */
export async function getBimpeCallEvidence(
  externalId: string,
  environment: BimpeAIEnvironment = process.env,
  fetchImpl: BimpeAIFetch = fetch
): Promise<{
  callId: string;
  transcript: string;
  sourceReference: string;
}> {
  const callId = fromBimpeExternalId(externalId);
  if (!callId) {
    throw new BimpeEvidenceUnavailableError(
      "Communication does not reference a BimpeAI call."
    );
  }

  let call;
  try {
    call = await getBimpeCallDetail(callId, environment, fetchImpl);
  } catch (error) {
    if (
      error instanceof BimpeAIConfigurationError ||
      error instanceof BimpeAIRequestError
    ) {
      throw new BimpeEvidenceUnavailableError(error.message);
    }
    throw error;
  }

  if (call.status.trim().toLowerCase() !== "ended") {
    throw new BimpeEvidenceUnavailableError(
      "BimpeAI call transcript is not final because the call has not ended."
    );
  }

  const transcript = normalizeTranscript(call.conversation_logs);
  if (!transcript) {
    throw new BimpeEvidenceUnavailableError(
      "BimpeAI call does not contain transcript evidence yet."
    );
  }

  return {
    callId,
    transcript,
    sourceReference: externalId
  };
}
