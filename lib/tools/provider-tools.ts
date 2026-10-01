import { z } from "zod";
import {
  communicationResultSchema,
  providerSchema,
  type Provider,
  type CommunicationResult
} from "../schemas";
import { MockCommunicationAdapter } from "../integrations/communication/mock";
import { initiateContactWithRecovery } from "../integrations/communication/recovery";
import type {
  ContactProviderInput,
  CommunicationAdapter
} from "../integrations/communication/types";
import { temporaryDemoProviders } from "../demo/temporary-scenario";

const optionalBimpeSearchStringSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.trim();

    if (!normalized || /^\{\{[^{}]+\}\}$/.test(normalized)) {
      return undefined;
    }

    return normalized;
  }

  return value;
}, z.string().min(1).optional());

export const searchProvidersInputSchema = z.object({
  query: optionalBimpeSearchStringSchema,
  category: optionalBimpeSearchStringSchema,
  location: optionalBimpeSearchStringSchema,
  language: optionalBimpeSearchStringSchema,
  verified: z.boolean().optional(),
  active: z.boolean().optional()
});

export type SearchProvidersInput = z.infer<typeof searchProvidersInputSchema>;

/**
 * Bounded provider search.
 *
 * Phase 1 source: temporaryDemoProviders.
 * This is an explicit demo source, not a live provider directory.
 *
 * The tool filters provider records but does not rank, recommend, or mutate them.
 */
export function searchProviders(input: SearchProvidersInput = {}): Provider[] {
  const filters = searchProvidersInputSchema.parse(input);

  return temporaryDemoProviders
    .filter((provider) => {
      if (filters.query) {
        const query = filters.query.toLowerCase();
        const searchableText = [
          provider.name,
          provider.category,
          provider.location,
          ...provider.languages
        ]
          .join(" ")
          .toLowerCase();

        if (!searchableText.includes(query)) {
          return false;
        }
      }

      if (
        filters.category &&
        provider.category.toLowerCase() !== filters.category.toLowerCase()
      ) {
        return false;
      }

      if (
        filters.location &&
        provider.location.toLowerCase() !== filters.location.toLowerCase()
      ) {
        return false;
      }

      if (
        filters.language &&
        !provider.languages.some(
          (language) =>
            language.toLowerCase() === filters.language!.toLowerCase()
        )
      ) {
        return false;
      }

      if (
        filters.verified !== undefined &&
        provider.verified !== filters.verified
      ) {
        return false;
      }

      if (
        filters.active !== undefined &&
        provider.active !== filters.active
      ) {
        return false;
      }

      return true;
    })
    .map((provider) => providerSchema.parse(provider));
}

/**
 * Retrieve one provider by its canonical provider ID.
 *
 * Phase 1 source: temporaryDemoProviders.
 * This is an explicit demo source, not a live provider directory.
 *
 * The tool returns a validated provider record and does not rank,
 * recommend, or mutate it.
 */
export function getProvider(providerId: string): Provider | undefined {
  const provider = temporaryDemoProviders.find(
    (provider) => provider.id === providerId
  );

  return provider ? providerSchema.parse(provider) : undefined;
}

export const callProviderInputSchema = z.object({
  missionId: z.string().trim().min(1),
  providerId: z.string().trim().min(1),
  objective: z.string().trim().min(1)
});

export type CallProviderInput = z.infer<typeof callProviderInputSchema>;

/**
 * Bounded provider contact tool.
 *
 * Phase 1 uses the existing mock communication adapter, so this does not
 * place a real call. Once a valid provider reaches the adapter boundary,
 * transport/provider failures are normalized to FAILED rather than being
 * mistaken for Mission failure or Quote evidence.
 */
export async function callProvider(
  input: CallProviderInput,
  adapter: CommunicationAdapter = new MockCommunicationAdapter()
): Promise<CommunicationResult> {
  const contact = callProviderInputSchema.parse(input);
  const provider = getProvider(contact.providerId);

  if (!provider) {
    throw new Error(`Provider not found: ${contact.providerId}`);
  }

  if (!provider.active) {
    throw new Error(`Provider is inactive: ${contact.providerId}`);
  }

  const contactInput: ContactProviderInput = {
    missionId: contact.missionId,
    providerId: contact.providerId,
    objective: contact.objective
  };

  return initiateContactWithRecovery({
    contact: contactInput,
    adapter,
    failureChannel: "CALL"
  });
}

export const sendMessageInputSchema = z.object({
  missionId: z.string().trim().min(1),
  providerId: z.string().trim().min(1),
  communicationId: z.string().trim().min(1),
  message: z.string().trim().min(1)
});

export type SendMessageInput = z.infer<typeof sendMessageInputSchema>;

export type MessageTransport = (
  input: SendMessageInput
) => Promise<CommunicationResult>;

/**
 * Bounded provider messaging tool.
 *
 * No verified live SMS transport is configured yet. Without an injected
 * transport this returns an explicit UNAVAILABLE result and does not send
 * anything. A future verified Temlio (or other approved) transport can be
 * injected without changing the tool input contract.
 */
export async function sendMessage(
  input: SendMessageInput,
  transport?: MessageTransport
): Promise<CommunicationResult> {
  const messageInput = sendMessageInputSchema.parse(input);
  const provider = getProvider(messageInput.providerId);

  if (!provider) {
    throw new Error(`Provider not found: ${messageInput.providerId}`);
  }

  if (!provider.active) {
    throw new Error(`Provider is inactive: ${messageInput.providerId}`);
  }

  if (!transport) {
    return communicationResultSchema.parse({
      id: messageInput.communicationId,
      missionId: messageInput.missionId,
      providerId: messageInput.providerId,
      channel: "SMS",
      status: "UNAVAILABLE",
      summary: "No verified live messaging transport is configured; no message was sent.",
      errorCode: "MESSAGE_TRANSPORT_UNAVAILABLE",
      occurredAt: new Date().toISOString()
    });
  }

  const result = communicationResultSchema.parse(await transport(messageInput));

  if (
    result.id !== messageInput.communicationId ||
    result.missionId !== messageInput.missionId ||
    result.providerId !== messageInput.providerId
  ) {
    throw new Error("Message transport returned mismatched correlation fields");
  }

  return result;
}
