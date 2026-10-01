import {
  communicationResultSchema
} from "../../schemas";
import type {
  MessageTransport,
  SendMessageInput
} from "../../tools/provider-tools";
import type { CommunicationCorrelationRepository } from "../../repositories/communication-correlation-repository";
import {
  createVoicebipMessageTransport,
  type VoicebipEnvironment,
  type VoicebipFetch
} from "./voicebip-message";

export const messageModeValues = ["disabled", "voicebip-temlio"] as const;
export type MessageMode = (typeof messageModeValues)[number];

function unsupportedModeTransport(mode: string): MessageTransport {
  return async (input: SendMessageInput) =>
    communicationResultSchema.parse({
      id: input.communicationId,
      missionId: input.missionId,
      providerId: input.providerId,
      channel: "SMS",
      status: "FAILED",
      summary: `Unsupported SABI_MESSAGE_MODE: ${mode}. No message was sent.`,
      errorCode: "UNSUPPORTED_MESSAGE_MODE",
      occurredAt: new Date().toISOString()
    });
}

export function createConfiguredMessageTransport(
  environment: VoicebipEnvironment = process.env,
  fetchImpl: VoicebipFetch = fetch,
  repository?: CommunicationCorrelationRepository
): MessageTransport | undefined {
  const mode = environment.SABI_MESSAGE_MODE?.trim() || "disabled";

  if (mode === "disabled") return undefined;
  if (mode === "voicebip-temlio") {
    return createVoicebipMessageTransport(environment, fetchImpl, repository);
  }

  return unsupportedModeTransport(mode);
}
