import { z } from "zod";
import {
  communicationResultSchema,
  type CommunicationResult
} from "../../schemas";
import type {
  MessageTransport,
  SendMessageInput
} from "../../tools/provider-tools";
import type { CommunicationCorrelationRepository } from "../../repositories/communication-correlation-repository";
import {
  createNeonCommunicationCorrelationRepositoryFromEnvironment,
  type NeonCommunicationCorrelationEnvironment
} from "../neon/communication-correlation-repository";

const e164PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Expected an E.164 phone number");

const consentedPhonesSchema = z.record(e164PhoneSchema);

const voicebipResponseSchema = z
  .object({
    message_id: z.string().trim().min(1),
    channel: z.literal("sms"),
    status: z.string().trim().min(1),
    from_number: e164PhoneSchema.optional(),
    to_number: e164PhoneSchema.optional(),
    created_at: z.string().datetime().optional()
  })
  .passthrough();

export type VoicebipEnvironment = NeonCommunicationCorrelationEnvironment & {
  [key: string]: string | undefined;
};

export type VoicebipFetch = typeof fetch;

type VoicebipConfiguration = {
  apiBaseUrl: string;
  apiKey: string;
  agentId: string;
  fromNumber: string;
  consentedProviderPhones: Record<string, string>;
};

function failed(
  input: SendMessageInput,
  errorCode: string,
  summary: string,
  externalId?: string
): CommunicationResult {
  return communicationResultSchema.parse({
    id: input.communicationId,
    missionId: input.missionId,
    providerId: input.providerId,
    channel: "SMS",
    status: "FAILED",
    externalId,
    summary,
    errorCode,
    occurredAt: new Date().toISOString()
  });
}

function readConsentedPhones(raw: string | undefined): Record<string, string> {
  if (!raw?.trim()) return {};

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    throw new Error(
      "SABI_CONSENTED_PROVIDER_MESSAGE_PHONES_JSON must be valid JSON."
    );
  }

  const parsed = consentedPhonesSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new Error(
      "SABI_CONSENTED_PROVIDER_MESSAGE_PHONES_JSON must map provider IDs to E.164 phone numbers."
    );
  }

  return parsed.data;
}

export function readVoicebipConfiguration(
  environment: VoicebipEnvironment = process.env
): VoicebipConfiguration {
  const parsed = z
    .object({
      apiBaseUrl: z.string().url(),
      apiKey: z.string().trim().min(1),
      agentId: z.string().trim().min(1),
      fromNumber: e164PhoneSchema
    })
    .safeParse({
      apiBaseUrl:
        environment.VOICEBIP_API_BASE_URL?.trim() ||
        "https://api.voicebip.com/v1",
      apiKey: environment.VOICEBIP_API_KEY,
      agentId: environment.VOICEBIP_AGENT_ID,
      fromNumber: environment.VOICEBIP_SMS_FROM_NUMBER
    });

  if (!parsed.success) {
    throw new Error(
      "Voicebip/Temlio SMS requires VOICEBIP_API_KEY, VOICEBIP_AGENT_ID and VOICEBIP_SMS_FROM_NUMBER."
    );
  }

  return {
    ...parsed.data,
    apiBaseUrl: parsed.data.apiBaseUrl.replace(/\/+$/, ""),
    consentedProviderPhones: readConsentedPhones(
      environment.SABI_CONSENTED_PROVIDER_MESSAGE_PHONES_JSON
    )
  };
}

function statusFromAcceptedResponse(status: string): "INITIATED" | "COMPLETED" | "FAILED" {
  switch (status.toLowerCase()) {
    case "delivered":
    case "read":
      return "COMPLETED";
    case "failed":
      return "FAILED";
    default:
      return "INITIATED";
  }
}

export function createVoicebipMessageTransport(
  environment: VoicebipEnvironment = process.env,
  fetchImpl: VoicebipFetch = fetch,
  explicitRepository?: CommunicationCorrelationRepository
): MessageTransport {
  return async (input) => {
    let configuration: VoicebipConfiguration;
    try {
      configuration = readVoicebipConfiguration(environment);
    } catch {
      return failed(
        input,
        "MESSAGE_TRANSPORT_CONFIGURATION_INVALID",
        "Voicebip/Temlio SMS is not fully configured; no message was sent."
      );
    }

    const destination =
      configuration.consentedProviderPhones[input.providerId];

    if (!destination) {
      return failed(
        input,
        "MESSAGE_DESTINATION_NOT_CONSENTED",
        "The provider has no explicitly consented SMS destination; no message was sent."
      );
    }

    let repository = explicitRepository;
    if (!repository) {
      try {
        repository =
          createNeonCommunicationCorrelationRepositoryFromEnvironment(
            environment
          );
      } catch {
        return failed(
          input,
          "MESSAGE_CORRELATION_STORAGE_INVALID",
          "Durable SMS correlation storage is invalid; no message was sent."
        );
      }
    }

    if (!repository) {
      return failed(
        input,
        "MESSAGE_CORRELATION_STORAGE_NOT_CONFIGURED",
        "Durable SMS correlation storage is required before live messaging; no message was sent."
      );
    }

    let existing;
    try {
      existing = await repository.getByCommunicationId(input.communicationId);
    } catch {
      return failed(
        input,
        "MESSAGE_CORRELATION_STORAGE_UNAVAILABLE",
        "SMS correlation storage is unavailable; no message was sent."
      );
    }

    if (existing) {
      if (
        existing.missionId !== input.missionId ||
        existing.providerId !== input.providerId
      ) {
        return failed(
          input,
          "MESSAGE_CORRELATION_CONFLICT",
          "The communication ID is already bound to a different mission or provider; no message was sent."
        );
      }

      if (existing.externalId) {
        return communicationResultSchema.parse({
          id: input.communicationId,
          missionId: input.missionId,
          providerId: input.providerId,
          channel: "SMS",
          status: "INITIATED",
          externalId: existing.externalId,
          summary:
            "This communication was already submitted previously. No duplicate SMS was sent; delivery remains pending verified provider events.",
          occurredAt: new Date().toISOString()
        });
      }

      return failed(
        input,
        "MESSAGE_SEND_STATE_AMBIGUOUS",
        "A previous send attempt exists without an external message ID. SABI will not retry automatically because delivery is unknown."
      );
    }

    try {
      await repository.savePending({
        communicationId: input.communicationId,
        missionId: input.missionId,
        providerId: input.providerId,
        channel: "SMS",
        createdAt: new Date().toISOString()
      });
    } catch {
      return failed(
        input,
        "MESSAGE_CORRELATION_STORAGE_UNAVAILABLE",
        "SABI could not persist the pre-send SMS correlation; no message was sent."
      );
    }

    let response: Response;
    try {
      response = await fetchImpl(`${configuration.apiBaseUrl}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${configuration.apiKey}`,
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        cache: "no-store",
        body: JSON.stringify({
          agent_id: configuration.agentId,
          channel: "sms",
          from_number: configuration.fromNumber,
          to_number: destination,
          body: input.message
        })
      });
    } catch {
      return failed(
        input,
        "MESSAGE_PROVIDER_NETWORK_FAILURE",
        "The Voicebip/Temlio request failed before SABI received a provider response. Delivery is not confirmed and no Quote evidence was produced."
      );
    }

    if (!response.ok) {
      return failed(
        input,
        `MESSAGE_PROVIDER_HTTP_${response.status}`,
        `Voicebip/Temlio returned HTTP ${response.status}. Delivery is not confirmed and no Quote evidence was produced.`
      );
    }

    let providerMessage: z.infer<typeof voicebipResponseSchema>;
    try {
      providerMessage = voicebipResponseSchema.parse(await response.json());
    } catch {
      return failed(
        input,
        "MESSAGE_PROVIDER_RESPONSE_INVALID",
        "Voicebip/Temlio returned an invalid message response. Delivery is not confirmed and no Quote evidence was produced."
      );
    }

    try {
      await repository.attachExternalId(
        input.communicationId,
        providerMessage.message_id
      );
    } catch {
      return failed(
        input,
        "MESSAGE_CORRELATION_PERSIST_FAILED",
        "Voicebip/Temlio accepted the SMS, but SABI could not persist the external message correlation. No automatic retry will be attempted.",
        providerMessage.message_id
      );
    }

    const status = statusFromAcceptedResponse(providerMessage.status);

    return communicationResultSchema.parse({
      id: input.communicationId,
      missionId: input.missionId,
      providerId: input.providerId,
      channel: "SMS",
      status,
      externalId: providerMessage.message_id,
      summary:
        status === "COMPLETED"
          ? "Voicebip/Temlio reports the SMS as delivered/read. No Quote has been inferred from delivery status."
          : status === "FAILED"
            ? "Voicebip/Temlio reports the SMS as failed. No Quote evidence was produced."
            : "Voicebip/Temlio accepted the SMS for delivery. Completion is pending verified delivery events.",
      errorCode:
        status === "FAILED" ? "MESSAGE_PROVIDER_REPORTED_FAILED" : undefined,
      occurredAt:
        providerMessage.created_at ?? new Date().toISOString()
    });
  };
}
