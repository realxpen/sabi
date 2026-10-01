import { z } from "zod";
import { providerSchema, type Mission, type Provider } from "../../schemas";
import { providerMatchesMissionItem } from "../../intelligence/constraints";

const liveTestProviderSchema = providerSchema.omit({ phone: true }).strict();
const liveTestProviderDirectorySchema = z.array(liveTestProviderSchema).max(25);

export type LiveTestProviderEnvironment = {
  [key: string]: string | undefined;
};

export type LiveTestProviderFilters = {
  query?: string;
  category?: string;
  location?: string;
  verified?: boolean;
  active?: boolean;
};

export class LiveTestProviderDirectoryConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiveTestProviderDirectoryConfigurationError";
  }
}

/**
 * Read a small, explicitly configured hackathon provider directory.
 *
 * Phone numbers are intentionally forbidden here. Live call destinations live
 * only in SABI_CONSENTED_PROVIDER_PHONES_JSON so provider metadata can be
 * returned to the agent without exposing the dialing secret/mapping.
 */
export function readLiveTestProviders(
  environment: LiveTestProviderEnvironment = process.env
): Provider[] | undefined {
  const raw = environment.SABI_LIVE_TEST_PROVIDERS_JSON?.trim();
  if (!raw) return undefined;

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    throw new LiveTestProviderDirectoryConfigurationError(
      "SABI_LIVE_TEST_PROVIDERS_JSON must be valid JSON."
    );
  }

  const parsed = liveTestProviderDirectorySchema.safeParse(decoded);
  if (!parsed.success) {
    throw new LiveTestProviderDirectoryConfigurationError(
      "SABI_LIVE_TEST_PROVIDERS_JSON must be an array of canonical provider metadata without phone numbers."
    );
  }

  const ids = new Set<string>();
  for (const provider of parsed.data) {
    if (ids.has(provider.id)) {
      throw new LiveTestProviderDirectoryConfigurationError(
        `Duplicate live test provider ID: ${provider.id}`
      );
    }
    ids.add(provider.id);
  }

  return parsed.data.map((provider) => providerSchema.parse(provider));
}

export function searchLiveTestProviders(
  filters: LiveTestProviderFilters = {},
  environment: LiveTestProviderEnvironment = process.env
): Provider[] | undefined {
  const providers = readLiveTestProviders(environment);
  if (!providers) return undefined;

  const query = filters.query?.trim().toLowerCase();
  const category = filters.category?.trim().toLowerCase();
  const location = filters.location?.trim().toLowerCase();

  return providers.filter((provider) => {
    if (query) {
      const haystack = [
        provider.name,
        provider.category,
        provider.location,
        ...provider.languages
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    if (category && provider.category.toLowerCase() !== category) return false;
    if (location && provider.location.toLowerCase() !== location) return false;
    if (filters.verified !== undefined && provider.verified !== filters.verified) {
      return false;
    }
    if (filters.active !== undefined && provider.active !== filters.active) {
      return false;
    }

    return true;
  });
}

export function getLiveTestProvider(
  providerId: string,
  environment: LiveTestProviderEnvironment = process.env
): Provider | undefined {
  return readLiveTestProviders(environment)?.find(
    (provider) => provider.id === providerId
  );
}

export function discoverLiveTestProvidersForMission(
  mission: Mission,
  environment: LiveTestProviderEnvironment = process.env
): Provider[] | undefined {
  return readLiveTestProviders(environment)?.filter(
    (provider) => provider.active && providerMatchesMissionItem(mission, provider)
  );
}
