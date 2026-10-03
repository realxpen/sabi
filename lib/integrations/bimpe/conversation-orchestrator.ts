import { z } from "zod";

export type BimpeConversationEnvironment = {
  [key: string]: string | undefined;
};

export type BimpeConversationFetch = typeof fetch;

const bimpeConversationResponseSchema = z
  .object({
    message: z.string().optional(),
    data: z
      .object({
        id: z.string().optional(),
        role: z.string().optional(),
        message: z.string().optional(),
        created_at: z.string().optional()
      })
      .passthrough()
      .optional()
  })
  .passthrough();

const trailingUuidPattern =
  /([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

export class BimpeConversationConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BimpeConversationConfigurationError";
  }
}

export class BimpeConversationRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BimpeConversationRequestError";
  }
}

export function missingBimpeMissionConfiguration(
  environment: BimpeConversationEnvironment = process.env
): string[] {
  return ["BIMPEAI_API_KEY", "BIMPEAI_AGENT_ID"].filter(
    (key) => !environment[key]?.trim()
  );
}

function readConfiguration(environment: BimpeConversationEnvironment) {
  const apiKey = environment.BIMPEAI_API_KEY?.trim();
  const agentId = environment.BIMPEAI_AGENT_ID?.trim();
  const apiBaseUrl = (
    environment.BIMPEAI_BASE_URL?.trim() ||
    "https://api.bimpe.ai/api/v1/console"
  ).replace(/\/$/, "");

  if (!apiKey || !agentId) {
    throw new BimpeConversationConfigurationError(
      "Bimpe mission orchestration requires BIMPEAI_API_KEY and BIMPEAI_AGENT_ID."
    );
  }

  return {
    apiKey,
    agentId,
    apiBaseUrl,
    isTestChannel:
      environment.BIMPEAI_ORCHESTRATION_TEST_CHANNEL?.trim().toLowerCase() ===
      "true"
  };
}

export function isBimpeMissionOrchestrationConfigured(
  environment: BimpeConversationEnvironment = process.env
): boolean {
  return missingBimpeMissionConfiguration(environment).length === 0;
}

/**
 * Bimpe requires a UUID channel_user_id for webchat. SABI Mission IDs always
 * end in a UUID, including both mission-<uuid> and mission-bimpe-<uuid> forms.
 * Reusing that UUID keeps every message for one Mission in the same Bimpe
 * conversation without storing another correlation identifier.
 */
export function missionChannelUserId(missionId: string): string {
  const normalized = z.string().trim().min(1).parse(missionId);
  const match = normalized.match(trailingUuidPattern);

  if (!match?.[1]) {
    throw new BimpeConversationConfigurationError(
      `Mission ${normalized} does not end in a UUID suitable for Bimpe webchat correlation.`
    );
  }

  return match[1].toLowerCase();
}

export async function sendBimpeMissionMessage(
  input: {
    missionId: string;
    message: string;
    requestId: string;
  },
  environment: BimpeConversationEnvironment = process.env,
  fetchImpl: BimpeConversationFetch = fetch
) {
  const configuration = readConfiguration(environment);
  const message = z.string().trim().min(1).max(4096).parse(input.message);
  const channelUserId = missionChannelUserId(input.missionId);

  let response: Response;
  try {
    response = await fetchImpl(
      `${configuration.apiBaseUrl}/agents/${encodeURIComponent(configuration.agentId)}/conversations/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${configuration.apiKey}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Request-Id": input.requestId
        },
        body: JSON.stringify({
          message,
          role: "user",
          channel_type: "webchat",
          channel_user_id: channelUserId,
          channel_username: `SABI ${input.missionId}`,
          is_test_channel: configuration.isTestChannel
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(45_000)
      }
    );
  } catch {
    throw new BimpeConversationRequestError(
      "Bimpe mission orchestration request could not be completed."
    );
  }

  if (!response.ok) {
    throw new BimpeConversationRequestError(
      `Bimpe mission orchestration failed with HTTP ${response.status}.`
    );
  }

  let decoded: unknown;
  try {
    decoded = await response.json();
  } catch {
    throw new BimpeConversationRequestError(
      "Bimpe returned invalid JSON for the mission conversation."
    );
  }

  const parsed = bimpeConversationResponseSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new BimpeConversationRequestError(
      "Bimpe returned an invalid mission conversation response."
    );
  }

  return {
    channelUserId,
    response: parsed.data
  };
}

export async function startBimpeMissionOrchestration(
  input: { missionId: string; request: string },
  environment: BimpeConversationEnvironment = process.env,
  fetchImpl: BimpeConversationFetch = fetch
) {
  const request = z.string().trim().min(1).parse(input.request);

  return sendBimpeMissionMessage(
    {
      missionId: input.missionId,
      requestId: `sabi-bimpe-start-${input.missionId}`,
      message: [
        "Continue an EXISTING LIVE SABI sourcing mission. This is a real provider-discovery and contact run, not a simulation.",
        `Mission ID: ${input.missionId}`,
        `User request: ${request}`,
        "Do not create a new mission and do not call Start Mission.",
        "Be concise, friendly and conversational when you produce user-facing text. Never invent progress or provider facts.",
        "First call Get Mission State with this exact mission ID and use the persisted mission constraints as truth.",
        "Then call Search Providers with mode LIVE using the mission's real need/category and location. Search the real provider registry; do not request or infer phone numbers. If an overly narrow search returns no result, retry once with a broader factual category or location term from the mission, never with invented data.",
        "From the returned live providers, select EXACTLY ONE active provider whose provider ID is also present in the persisted mission provider list. Prefer the clearest factual category/location match. If there is no safe matching intersection, stop and report that no callable match was verified.",
        "Call Get Provider for that selected provider ID with mode LIVE so the provider identity is verified before contact.",
        "Advance the SAME mission one safe stage at a time using Orchestrate Mission with mode LIVE. Re-read mission state as needed. Stop orchestration as soon as the persisted status becomes CONTACTING, WAITING, or a human checkpoint.",
        "IMPORTANT: when persisted status is CONTACTING, do not call Orchestrate Mission again. Re-check existing communications. If the selected provider has no persisted communication, call Call Provider exactly ONCE for that selected provider. Never call every provider in the list for this hackathon run.",
        "After the provider call is initiated, stop and wait for persisted communication evidence. INITIATED is not COMPLETED. Do not invent availability, quantity, price, delivery fee, total, timing, or Quote facts.",
        "Never purchase, pay, book, promise payment, or bypass the human approval checkpoint."
      ].join("\n")
    },
    environment,
    fetchImpl
  );
}

export async function resumeBimpeMissionAfterCommunication(
  input: {
    missionId: string;
    communicationId: string;
    communicationStatus: string;
  },
  environment: BimpeConversationEnvironment = process.env,
  fetchImpl: BimpeConversationFetch = fetch
) {
  return sendBimpeMissionMessage(
    {
      missionId: input.missionId,
      requestId: `sabi-bimpe-resume-${input.communicationId}-${input.communicationStatus}`,
      message: [
        "Resume the EXISTING SABI mission after a real provider communication update.",
        `Mission ID: ${input.missionId}`,
        `Communication ID: ${input.communicationId}`,
        `Persisted communication status: ${input.communicationStatus}`,
        "Do not create a new mission and do not call Start Mission.",
        "Be concise and friendly, but truthfulness is more important than conversational polish.",
        "First call Get Mission State with this exact mission ID.",
        "If a completed call still has no persisted Quote, call Get Communication Evidence for this communication and extract only facts explicitly supported by the provider evidence. Then use Record Provider Response with the same mission ID and communication ID. Unknown facts must stay unknown.",
        "When validated Quotes are ready, advance the existing mission safely, compare verified Quotes, and request human approval only when a recommendation is ready.",
        "Stop on WAITING, unknown/missing evidence, NO_VALID_OPTIONS, or the human approval checkpoint. Never purchase, pay, book, or promise payment."
      ].join("\n")
    },
    environment,
    fetchImpl
  );
}
