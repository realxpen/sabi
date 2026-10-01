import { z } from "zod";

const vapiEvidenceConfigurationSchema = z.object({
  apiBaseUrl: z.enum(["https://api.vapi.ai", "https://api.eu.vapi.ai"]),
  apiKey: z.string().trim().min(1),
  assistantId: z.string().trim().min(1)
});

const transcriptEntrySchema = z
  .object({
    role: z.string().trim().min(1),
    message: z.string().optional(),
    content: z.string().optional()
  })
  .passthrough();

const callEvidenceSchema = z
  .object({
    id: z.string().trim().min(1),
    assistantId: z.string().trim().min(1).optional(),
    artifact: z
      .object({
        transcript: z.unknown().optional(),
        messagesOpenAIFormatted: z.unknown().optional()
      })
      .passthrough()
      .optional()
  })
  .passthrough();

export type VapiEvidenceEnvironment = {
  [key: string]: string | undefined;
};

export type VapiEvidenceFetch = typeof fetch;

export class VapiEvidenceConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VapiEvidenceConfigurationError";
  }
}

export class VapiEvidenceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VapiEvidenceUnavailableError";
  }
}

function readConfiguration(environment: VapiEvidenceEnvironment) {
  const parsed = vapiEvidenceConfigurationSchema.safeParse({
    apiBaseUrl: environment.VAPI_API_BASE_URL,
    apiKey: environment.VAPI_API_KEY,
    assistantId: environment.VAPI_ASSISTANT_ID
  });

  if (!parsed.success) {
    throw new VapiEvidenceConfigurationError(
      "Vapi call evidence requires VAPI_API_BASE_URL, VAPI_API_KEY and VAPI_ASSISTANT_ID."
    );
  }

  return parsed.data;
}

function normalizeTranscript(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  const entries = z.array(transcriptEntrySchema).safeParse(value);
  if (!entries.success) return undefined;

  const lines = entries.data
    .map((entry) => {
      const text = entry.message?.trim() || entry.content?.trim();
      return text ? `${entry.role}: ${text}` : undefined;
    })
    .filter((line): line is string => Boolean(line));

  return lines.length ? lines.join("\n") : undefined;
}

/**
 * Retrieve transcript evidence for one known Vapi call.
 *
 * This helper performs read-only authenticated retrieval. It never persists the
 * transcript, creates a Quote, changes a Mission, or exposes the private API key.
 * It accepts the transcript formats documented by Vapi: a transcript value or
 * OpenAI-formatted message entries.
 */
export async function getVapiCallEvidence(
  callId: string,
  environment: VapiEvidenceEnvironment = process.env,
  fetchImpl: VapiEvidenceFetch = fetch
): Promise<{
  callId: string;
  assistantId: string;
  transcript: string;
  sourceReference: string;
}> {
  const normalizedCallId = z.string().trim().min(1).parse(callId);
  const configuration = readConfiguration(environment);

  let response: Response;
  try {
    response = await fetchImpl(
      `${configuration.apiBaseUrl}/call/${encodeURIComponent(normalizedCallId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${configuration.apiKey}`,
          Accept: "application/json"
        },
        cache: "no-store"
      }
    );
  } catch {
    throw new VapiEvidenceUnavailableError(
      "Vapi call evidence request could not be completed."
    );
  }

  if (response.status === 404) {
    throw new VapiEvidenceUnavailableError("Vapi call evidence was not found.");
  }

  if (!response.ok) {
    throw new VapiEvidenceUnavailableError(
      `Vapi call evidence request failed with HTTP ${response.status}.`
    );
  }

  let decoded: unknown;
  try {
    decoded = await response.json();
  } catch {
    throw new VapiEvidenceUnavailableError(
      "Vapi returned invalid JSON for call evidence."
    );
  }

  const call = callEvidenceSchema.safeParse(decoded);
  if (!call.success) {
    throw new VapiEvidenceUnavailableError(
      "Vapi returned an invalid call evidence record."
    );
  }

  if (call.data.id !== normalizedCallId) {
    throw new VapiEvidenceUnavailableError(
      "Vapi call evidence ID did not match the requested call."
    );
  }

  if (call.data.assistantId !== configuration.assistantId) {
    throw new VapiEvidenceUnavailableError(
      "Vapi call evidence belongs to an unexpected assistant."
    );
  }

  const transcript =
    normalizeTranscript(call.data.artifact?.transcript) ??
    normalizeTranscript(call.data.artifact?.messagesOpenAIFormatted);

  if (!transcript) {
    throw new VapiEvidenceUnavailableError(
      "Vapi call evidence does not contain an available transcript yet."
    );
  }

  return {
    callId: call.data.id,
    assistantId: configuration.assistantId,
    transcript,
    sourceReference: call.data.id
  };
}
