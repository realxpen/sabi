import { z } from "zod";
import {
  communicationResultSchema,
  type CommunicationResult,
  type CommunicationStatus
} from "../../schemas";
import type {
  CommunicationAdapter,
  ContactProviderInput
} from "./types";

export type BimpeAIEnvironment = {
  [key: string]: string | undefined;
};

export type BimpeAIFetch = typeof fetch;

const e164Schema = z.string().regex(/^\+[1-9]\d{6,14}$/);

const callCreationEnvelopeSchema = z.object({
  data: z.object({
    status: z.string().trim().min(1),
    call_id: z.string().trim().min(1),
    detail: z.string().optional()
  })
});

const callDetailSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    call_id: z.string().trim().min(1).optional(),
    status: z.string().trim().min(1),
    error_reason: z.string().nullish(),
    end_reason: z.string().nullish(),
    created_on: z.string().optional(),
    started_at: z.string().optional(),
    ringing_at: z.string().optional(),
    answered_at: z.string().optional(),
    ended_at: z.string().optional(),
    conversation_logs: z.unknown().optional()
  })
  .passthrough();

const callDetailEnvelopeSchema = z.object({
  data: callDetailSchema
});

const normalizePayloadSchema = z.object({
  missionId: z.string().trim().min(1),
  providerId: z.string().trim().min(1),
  communicationId: z.string().trim().min(1).optional(),
  call: z.unknown()
});

export class BimpeAIConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BimpeAIConfigurationError";
  }
}

export class BimpeAIRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BimpeAIRequestError";
  }
}

function readConfiguration(environment: BimpeAIEnvironment) {
  const apiKey = environment.BIMPEAI_API_KEY?.trim();
  const agentId = environment.BIMPEAI_AGENT_ID?.trim();
  const apiBaseUrl = (
    environment.BIMPEAI_BASE_URL?.trim() ||
    "https://api.bimpe.ai/api/v1/console"
  ).replace(/\/$/, "");

  if (!apiKey || !agentId) {
    throw new BimpeAIConfigurationError(
      "BimpeAI communication requires BIMPEAI_API_KEY and BIMPEAI_AGENT_ID."
    );
  }

  return {
    apiKey,
    agentId,
    apiBaseUrl,
    isTestCall: environment.BIMPEAI_TEST_CALLS?.trim().toLowerCase() !== "false"
  };
}

function readConsentedPhone(
  providerId: string,
  environment: BimpeAIEnvironment
): string {
  const raw = environment.SABI_CONSENTED_PROVIDER_PHONES_JSON?.trim();
  if (!raw) {
    throw new BimpeAIConfigurationError(
      "No consented provider phone map is configured."
    );
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    throw new BimpeAIConfigurationError(
      "SABI_CONSENTED_PROVIDER_PHONES_JSON is not valid JSON."
    );
  }

  const record = z.record(z.string()).safeParse(decoded);
  if (!record.success) {
    throw new BimpeAIConfigurationError(
      "SABI_CONSENTED_PROVIDER_PHONES_JSON must map provider IDs to E.164 phone numbers."
    );
  }

  const phone = record.data[providerId];
  if (!phone) {
    throw new BimpeAIConfigurationError(
      `Provider ${providerId} has no explicitly consented phone number.`
    );
  }

  const parsed = e164Schema.safeParse(phone);
  if (!parsed.success) {
    throw new BimpeAIConfigurationError(
      `Provider ${providerId} has an invalid E.164 phone number.`
    );
  }

  return parsed.data;
}

function statusFromBimpe(status: string): CommunicationStatus {
  switch (status.trim().toLowerCase()) {
    case "initiated":
    case "queued":
      return "INITIATED";
    case "ringing":
    case "answered":
    case "in_progress":
      return "IN_PROGRESS";
    case "ended":
    case "completed":
      return "COMPLETED";
    case "busy":
    case "no_answer":
      return "NO_ANSWER";
    case "cancelled":
    case "failed":
      return "FAILED";
    default:
      return "IN_PROGRESS";
  }
}

function unwrapCallDetail(value: unknown) {
  const envelope = callDetailEnvelopeSchema.safeParse(value);
  if (envelope.success) return envelope.data.data;

  const direct = callDetailSchema.safeParse(value);
  if (direct.success) return direct.data;

  throw new BimpeAIRequestError("BimpeAI returned an invalid call detail record.");
}

export function toBimpeExternalId(callId: string): string {
  return `bimpe:${callId}`;
}

export function fromBimpeExternalId(externalId: string): string | undefined {
  return externalId.startsWith("bimpe:") ? externalId.slice("bimpe:".length) : undefined;
}

export async function getBimpeCallDetail(
  callId: string,
  environment: BimpeAIEnvironment = process.env,
  fetchImpl: BimpeAIFetch = fetch
) {
  const config = readConfiguration(environment);
  const normalizedCallId = z.string().trim().min(1).parse(callId);

  let response: Response;
  try {
    response = await fetchImpl(
      `${config.apiBaseUrl}/agents/${encodeURIComponent(config.agentId)}/calls/${encodeURIComponent(normalizedCallId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          Accept: "application/json",
          "X-Request-Id": `sabi-bimpe-call-${normalizedCallId}`
        },
        cache: "no-store"
      }
    );
  } catch {
    throw new BimpeAIRequestError("BimpeAI call detail request could not be completed.");
  }

  if (!response.ok) {
    throw new BimpeAIRequestError(
      `BimpeAI call detail request failed with HTTP ${response.status}.`
    );
  }

  let decoded: unknown;
  try {
    decoded = await response.json();
  } catch {
    throw new BimpeAIRequestError("BimpeAI returned invalid JSON for call detail.");
  }

  const call = unwrapCallDetail(decoded);
  const returnedId = call.id ?? call.call_id;
  if (returnedId && returnedId !== normalizedCallId) {
    throw new BimpeAIRequestError(
      "BimpeAI call detail ID did not match the requested call."
    );
  }

  return call;
}

export class BimpeAICommunicationAdapter implements CommunicationAdapter {
  readonly name = "bimpe-ai";

  constructor(
    private readonly environment: BimpeAIEnvironment = process.env,
    private readonly fetchImpl: BimpeAIFetch = fetch
  ) {}

  async initiateContact(input: ContactProviderInput): Promise<CommunicationResult> {
    const config = readConfiguration(this.environment);
    const destination = readConsentedPhone(input.providerId, this.environment);
    const requestId = `sabi-${input.missionId}-${input.providerId}`;

    let response: Response;
    try {
      response = await this.fetchImpl(
        `${config.apiBaseUrl}/agents/${encodeURIComponent(config.agentId)}/calls`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            Accept: "application/json",
            "Content-Type": "application/json",
            "Idempotency-Key": requestId,
            "X-Request-Id": requestId
          },
          body: JSON.stringify({
            destination,
            is_test_call: config.isTestCall
          }),
          cache: "no-store"
        }
      );
    } catch {
      throw new BimpeAIRequestError("BimpeAI outbound call request could not be completed.");
    }

    if (!response.ok) {
      throw new BimpeAIRequestError(
        `BimpeAI outbound call request failed with HTTP ${response.status}.`
      );
    }

    let decoded: unknown;
    try {
      decoded = await response.json();
    } catch {
      throw new BimpeAIRequestError("BimpeAI returned invalid JSON for outbound call initiation.");
    }

    const parsed = callCreationEnvelopeSchema.safeParse(decoded);
    if (!parsed.success) {
      throw new BimpeAIRequestError("BimpeAI returned an invalid outbound call response.");
    }

    const { call_id: callId, status } = parsed.data.data;

    return communicationResultSchema.parse({
      id: `communication-bimpe-${callId}`,
      missionId: input.missionId,
      providerId: input.providerId,
      channel: "CALL",
      status: statusFromBimpe(status),
      externalId: toBimpeExternalId(callId),
      summary: config.isTestCall
        ? "BimpeAI test outbound call accepted. No provider facts have been inferred."
        : "BimpeAI outbound call accepted. No provider facts have been inferred.",
      occurredAt: new Date().toISOString()
    });
  }

  async normalizeEvent(payload: unknown): Promise<CommunicationResult> {
    const parsed = normalizePayloadSchema.parse(payload);
    const call = unwrapCallDetail(parsed.call);
    const callId = call.id ?? call.call_id;

    if (!callId) {
      throw new BimpeAIRequestError("BimpeAI call detail is missing its call ID.");
    }

    const status = statusFromBimpe(call.status);
    const errorCode = call.error_reason?.trim() || undefined;

    return communicationResultSchema.parse({
      id: parsed.communicationId ?? `communication-bimpe-${callId}`,
      missionId: parsed.missionId,
      providerId: parsed.providerId,
      channel: "CALL",
      status,
      externalId: toBimpeExternalId(callId),
      summary:
        status === "COMPLETED"
          ? "BimpeAI call completed. Transcript evidence can be retrieved separately; no Quote was created automatically."
          : status === "NO_ANSWER"
            ? "BimpeAI call did not reach the provider. No Quote was created."
            : status === "FAILED"
              ? "BimpeAI call failed. No Quote was created."
              : "BimpeAI call is still in progress.",
      errorCode,
      occurredAt:
        call.ended_at ??
        call.answered_at ??
        call.ringing_at ??
        call.started_at ??
        call.created_on ??
        new Date().toISOString()
    });
  }

  async refreshCommunication(
    communication: CommunicationResult
  ): Promise<CommunicationResult> {
    const externalId = communication.externalId;
    if (!externalId) {
      throw new BimpeAIRequestError("Communication has no BimpeAI call ID.");
    }

    const callId = fromBimpeExternalId(externalId);
    if (!callId) {
      throw new BimpeAIRequestError("Communication does not belong to BimpeAI.");
    }

    const call = await getBimpeCallDetail(callId, this.environment, this.fetchImpl);
    return this.normalizeEvent({
      missionId: communication.missionId,
      providerId: communication.providerId,
      communicationId: communication.id,
      call
    });
  }
}
