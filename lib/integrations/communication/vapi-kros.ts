import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  communicationResultSchema,
  type CommunicationResult,
  type CommunicationStatus
} from "../../schemas";
import { vapiApiBaseUrlSchema } from "../voice-runtime/vapi";
import type {
  CommunicationAdapter,
  ContactProviderInput
} from "./types";

const e164PhoneSchema = z.string().trim().regex(/^\+[1-9]\d{7,14}$/);
const consentedProviderPhonesSchema = z.record(e164PhoneSchema);
const vapiPhoneNumberSchema = z.object({
  id: z.string().trim().min(1),
  provider: z.string().trim().min(1),
  credentialId: z.string().trim().min(1).optional()
}).passthrough();
const vapiPhoneNumberListSchema = z.array(vapiPhoneNumberSchema);
const vapiCallResponseSchema = z.object({
  id: z.string().trim().min(1),
  status: z.string().trim().min(1).optional(),
  endedReason: z.string().trim().min(1).optional(),
  assistantId: z.string().trim().min(1).optional(),
  updatedAt: z.string().trim().min(1).optional()
}).passthrough();
const vapiVariableValuesSchema = z.object({
  missionId: z.string().trim().min(1),
  providerId: z.string().trim().min(1),
  communicationId: z.string().trim().min(1),
  objective: z.string().trim().min(1).optional()
}).passthrough();
const vapiServerEventSchema = z.object({
  message: z.object({
    type: z.string().trim().min(1),
    timestamp: z.union([z.string(), z.number()]).optional(),
    status: z.string().trim().min(1).optional(),
    endedReason: z.string().trim().min(1).optional(),
    call: z.object({
      id: z.string().trim().min(1),
      status: z.string().trim().min(1).optional(),
      endedReason: z.string().trim().min(1).optional(),
      assistantOverrides: z.object({
        variableValues: z.record(z.unknown()).optional()
      }).passthrough().optional()
    }).passthrough(),
    artifact: z.object({ transcript: z.string().optional() }).passthrough().optional(),
    transcript: z.string().optional()
  }).passthrough()
}).passthrough();

export type VapiKrosEnvironment = { [key: string]: string | undefined };
export type VapiKrosFetch = typeof fetch;

export class VapiKrosConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VapiKrosConfigurationError";
  }
}

export class LiveCallConsentError extends Error {
  constructor(providerId: string) {
    super(`Provider ${providerId} has no explicitly consented live-call phone mapping.`);
    this.name = "LiveCallConsentError";
  }
}

type VapiKrosConfiguration = {
  apiBaseUrl: z.infer<typeof vapiApiBaseUrlSchema>;
  apiKey: string;
  assistantId: string;
  sipTrunkCredentialId: string;
  consentedProviderPhones: Record<string, string>;
};

function readConsentedProviderPhones(raw: string | undefined): Record<string, string> {
  if (!raw?.trim()) return {};
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    throw new VapiKrosConfigurationError("SABI_CONSENTED_PROVIDER_PHONES_JSON must be valid JSON.");
  }
  const parsed = consentedProviderPhonesSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new VapiKrosConfigurationError("SABI_CONSENTED_PROVIDER_PHONES_JSON must map provider IDs to E.164 phone numbers.");
  }
  return parsed.data;
}

export function readVapiKrosConfiguration(
  environment: VapiKrosEnvironment = process.env
): VapiKrosConfiguration {
  const parsed = z.object({
    apiBaseUrl: vapiApiBaseUrlSchema,
    apiKey: z.string().trim().min(1),
    assistantId: z.string().trim().min(1),
    sipTrunkCredentialId: z.string().trim().min(1)
  }).safeParse({
    apiBaseUrl: environment.VAPI_API_BASE_URL,
    apiKey: environment.VAPI_API_KEY,
    assistantId: environment.VAPI_ASSISTANT_ID,
    sipTrunkCredentialId: environment.VAPI_SIP_TRUNK_CREDENTIAL_ID
  });

  if (!parsed.success) {
    throw new VapiKrosConfigurationError(
      "Live Vapi/Kros calling requires VAPI_API_BASE_URL, VAPI_API_KEY, VAPI_ASSISTANT_ID and VAPI_SIP_TRUNK_CREDENTIAL_ID."
    );
  }

  return {
    ...parsed.data,
    consentedProviderPhones: readConsentedProviderPhones(
      environment.SABI_CONSENTED_PROVIDER_PHONES_JSON
    )
  };
}

function eventOccurredAt(timestamp: string | number | undefined): string {
  if (typeof timestamp === "string") {
    const parsed = Date.parse(timestamp);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  if (typeof timestamp === "number") {
    const milliseconds = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
    const parsed = new Date(milliseconds);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

function statusForEndedReason(endedReason: string | undefined): CommunicationStatus {
  if (!endedReason) return "COMPLETED";
  if (["customer-did-not-answer", "customer-busy", "voicemail"].includes(endedReason)) {
    return "NO_ANSWER";
  }
  if (
    endedReason.includes("error-") ||
    endedReason.includes("failed") ||
    endedReason.endsWith("-worker-died") ||
    endedReason === "worker-shutdown" ||
    endedReason === "phone-call-provider-closed-websocket" ||
    endedReason === "phone-call-provider-bypass-enabled-but-no-call-received" ||
    endedReason.startsWith("assistant-not-") ||
    endedReason.startsWith("assistant-request-")
  ) {
    return "FAILED";
  }
  return "COMPLETED";
}

function statusForVapiEvent(
  type: string,
  status: string | undefined,
  endedReason: string | undefined
): CommunicationStatus {
  if (type === "end-of-call-report") return statusForEndedReason(endedReason);
  if (type === "transcript") return "IN_PROGRESS";
  if (type !== "status-update") throw new Error(`Unsupported Vapi server message type: ${type}`);

  switch (status) {
    case "scheduled":
    case "queued":
    case "ringing":
      return "INITIATED";
    case "in-progress":
    case "forwarding":
      return "IN_PROGRESS";
    case "ended":
      return statusForEndedReason(endedReason);
    default:
      throw new Error(`Unsupported Vapi call status: ${status ?? "unknown"}`);
  }
}

function summaryForPolledCall(
  status: CommunicationStatus,
  vapiStatus: string | undefined,
  endedReason: string | undefined
): string {
  if (status === "NO_ANSWER") {
    return `Vapi reports that the provider call ended without an answer (${endedReason ?? "no-answer"}). No Quote evidence was produced.`;
  }
  if (status === "FAILED") {
    return `Vapi reports that the provider call failed (${endedReason ?? "provider/runtime failure"}). No Quote evidence was produced.`;
  }
  if (status === "COMPLETED") {
    return "Vapi reports that the provider call ended. Completion alone does not prove any Quote facts; retrieve verified communication evidence before recording a provider response.";
  }
  if (status === "IN_PROGRESS") {
    return "Vapi reports that the provider call is in progress. No provider facts have been inferred from call status.";
  }
  return `Vapi reports call status ${vapiStatus ?? "pending"}. The call has been initiated but no provider facts have been verified.`;
}

export function extractVapiEventCorrelation(payload: unknown): {
  missionId: string;
  providerId: string;
} | undefined {
  const parsed = vapiServerEventSchema.safeParse(payload);
  if (!parsed.success) return undefined;
  const variables = vapiVariableValuesSchema.safeParse(
    parsed.data.message.call.assistantOverrides?.variableValues
  );
  return variables.success
    ? { missionId: variables.data.missionId, providerId: variables.data.providerId }
    : undefined;
}

export class VapiKrosCommunicationAdapter implements CommunicationAdapter {
  readonly name = "vapi-kros";

  constructor(
    private readonly environment: VapiKrosEnvironment = process.env,
    private readonly fetchImpl: VapiKrosFetch = fetch
  ) {}

  private async getConfiguredPhoneNumberId(
    configuration: VapiKrosConfiguration
  ): Promise<string> {
    const response = await this.fetchImpl(`${configuration.apiBaseUrl}/phone-number`, {
      method: "GET",
      headers: { Authorization: `Bearer ${configuration.apiKey}`, Accept: "application/json" },
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`Vapi phone-number lookup failed with HTTP ${response.status}`);
    const phoneNumbers = vapiPhoneNumberListSchema.parse(await response.json());
    const matchingPhoneNumber = phoneNumbers.find(
      (phoneNumber) =>
        phoneNumber.provider === "byo-phone-number" &&
        phoneNumber.credentialId === configuration.sipTrunkCredentialId
    );
    if (!matchingPhoneNumber) {
      throw new VapiKrosConfigurationError(
        "The configured Vapi SIP trunk credential is not attached to a BYO phone number."
      );
    }
    return matchingPhoneNumber.id;
  }

  async initiateContact(input: ContactProviderInput): Promise<CommunicationResult> {
    const configuration = readVapiKrosConfiguration(this.environment);
    const destination = configuration.consentedProviderPhones[input.providerId];
    if (!destination) throw new LiveCallConsentError(input.providerId);

    const phoneNumberId = await this.getConfiguredPhoneNumberId(configuration);
    const communicationId = `communication-${randomUUID()}`;
    const response = await this.fetchImpl(`${configuration.apiBaseUrl}/call`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${configuration.apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      cache: "no-store",
      body: JSON.stringify({
        assistantId: configuration.assistantId,
        customer: { number: destination },
        phoneNumberId,
        assistantOverrides: {
          variableValues: {
            missionId: input.missionId,
            providerId: input.providerId,
            communicationId,
            objective: input.objective
          }
        }
      })
    });
    if (!response.ok) throw new Error(`Vapi call initiation failed with HTTP ${response.status}`);
    const call = vapiCallResponseSchema.parse(await response.json());
    return communicationResultSchema.parse({
      id: communicationId,
      missionId: input.missionId,
      providerId: input.providerId,
      channel: "CALL",
      status: "INITIATED",
      externalId: call.id,
      summary:
        "Live call initiation was accepted by Vapi using the configured Kros BYO SIP transport. Completion and any factual Quote evidence are pending verified call events.",
      occurredAt: new Date().toISOString()
    });
  }

  async refreshCommunication(
    communication: CommunicationResult
  ): Promise<CommunicationResult> {
    if (communication.channel !== "CALL") {
      throw new Error("VAPI_REFRESH_REQUIRES_CALL_COMMUNICATION");
    }
    if (!communication.externalId) {
      throw new Error("COMMUNICATION_EXTERNAL_ID_REQUIRED");
    }

    const configuration = readVapiKrosConfiguration(this.environment);
    const response = await this.fetchImpl(
      `${configuration.apiBaseUrl}/call/${encodeURIComponent(communication.externalId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${configuration.apiKey}`,
          Accept: "application/json"
        },
        cache: "no-store"
      }
    );
    if (!response.ok) {
      throw new Error(`Vapi call refresh failed with HTTP ${response.status}`);
    }

    const call = vapiCallResponseSchema.parse(await response.json());
    if (call.id !== communication.externalId) {
      throw new Error("VAPI_CALL_ID_MISMATCH");
    }
    if (call.assistantId && call.assistantId !== configuration.assistantId) {
      throw new Error("VAPI_ASSISTANT_ID_MISMATCH");
    }

    const status = statusForVapiEvent(
      "status-update",
      call.status,
      call.endedReason
    );

    return communicationResultSchema.parse({
      ...communication,
      status,
      summary: summaryForPolledCall(status, call.status, call.endedReason),
      errorCode:
        status === "FAILED"
          ? call.endedReason ?? "VAPI_CALL_FAILED"
          : status === "NO_ANSWER"
            ? call.endedReason ?? "VAPI_NO_ANSWER"
            : undefined,
      occurredAt: eventOccurredAt(call.updatedAt)
    });
  }

  async normalizeEvent(payload: unknown): Promise<CommunicationResult> {
    const event = vapiServerEventSchema.parse(payload);
    const variables = vapiVariableValuesSchema.parse(
      event.message.call.assistantOverrides?.variableValues
    );
    const endedReason = event.message.endedReason ?? event.message.call.endedReason;
    const status = statusForVapiEvent(
      event.message.type,
      event.message.status ?? event.message.call.status,
      endedReason
    );
    const transcript = event.message.artifact?.transcript ?? event.message.transcript;
    const transcriptEvidence = Boolean(transcript?.trim());

    return communicationResultSchema.parse({
      id: variables.communicationId,
      missionId: variables.missionId,
      providerId: variables.providerId,
      channel: "CALL",
      status,
      externalId: event.message.call.id,
      summary:
        status === "NO_ANSWER"
          ? `Live provider call ended without reaching the provider (${endedReason ?? "no-answer"}). No Quote evidence was produced.`
          : status === "FAILED"
            ? `Live provider call failed (${endedReason ?? "provider/runtime failure"}). No Quote evidence was produced.`
            : transcriptEvidence
              ? "Verified Vapi call event includes transcript evidence. The transcript is evidence only and has not been converted into a Quote."
              : "Verified Vapi call lifecycle event received. No Quote has been inferred from call status alone.",
      errorCode:
        status === "FAILED"
          ? endedReason ?? "VAPI_CALL_FAILED"
          : status === "NO_ANSWER"
            ? endedReason ?? "VAPI_NO_ANSWER"
            : undefined,
      occurredAt: eventOccurredAt(event.message.timestamp)
    });
  }
}
