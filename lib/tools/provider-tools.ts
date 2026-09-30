import { z } from "zod";
import { providerSchema, type Provider, type CommunicationResult } from "../schemas";
import { MockCommunicationAdapter } from "../integrations/communication/mock";
import type { ContactProviderInput, CommunicationAdapter } from "../integrations/communication/types";
import { temporaryDemoProviders } from "../demo/temporary-scenario";

export const searchProvidersInputSchema = z.object({
  query: z.string().trim().optional(),
  category: z.string().trim().optional(),
  location: z.string().trim().optional(),
  language: z.string().trim().optional(),
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
 * place a real call. The adapter boundary is kept explicit so a verified
 * live communication adapter can be supplied later without changing the
 * tool contract.
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

  return adapter.initiateContact(contactInput);
}
