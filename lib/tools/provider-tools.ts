import { z } from "zod";
import { providerSchema, type Provider } from "../schemas";
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
