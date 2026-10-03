import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { providerMatchesMissionItem } from "../../intelligence/constraints";
import { providerSchema, type Mission, type Provider } from "../../schemas";

const e164PhoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/);

export const createRegisteredProviderInputSchema = z.object({
  name: z.string().trim().min(2),
  category: z.string().trim().min(2),
  location: z.string().trim().min(2),
  phone: z.string().trim().min(8),
  languages: z.array(z.string().trim().min(1)).min(1).default(["English"]),
  consentedToLiveContact: z.literal(true)
});

export type CreateRegisteredProviderInput = z.infer<
  typeof createRegisteredProviderInputSchema
>;

export type RegisteredProviderFilters = {
  query?: string;
  category?: string;
  location?: string;
  verified?: boolean;
  active?: boolean;
};

type ProviderRegistryRow = {
  id: string;
  provider: unknown;
  phone: string;
  consented: boolean;
};

function hasDatabaseConfiguration() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL_NOT_CONFIGURED");
  return neon(databaseUrl);
}

async function ensureProviderRegistryTable() {
  const sql = getSql();
  await sql`
    create table if not exists provider_registry (
      id text primary key,
      provider jsonb not null,
      phone text not null,
      consented boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  return sql;
}

export function normalizeProviderPhone(value: string): string {
  const compact = value.replace(/[\s()-]/g, "");
  let normalized = compact;

  if (/^0\d{10}$/.test(compact)) {
    normalized = `+234${compact.slice(1)}`;
  } else if (/^234\d{10}$/.test(compact)) {
    normalized = `+${compact}`;
  }

  return e164PhoneSchema.parse(normalized);
}

function providerIdFor(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 36) || "vendor";
  return `provider-${slug}-${randomUUID().slice(0, 8)}`;
}

function matchesFilters(provider: Provider, filters: RegisteredProviderFilters) {
  const query = filters.query?.trim().toLowerCase();
  const category = filters.category?.trim().toLowerCase();
  const location = filters.location?.trim().toLowerCase();

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
  if (filters.active !== undefined && provider.active !== filters.active) return false;

  return true;
}

export async function createRegisteredProvider(
  input: CreateRegisteredProviderInput
): Promise<Provider> {
  const parsed = createRegisteredProviderInputSchema.parse(input);
  const sql = await ensureProviderRegistryTable();
  const phone = normalizeProviderPhone(parsed.phone);
  const provider = providerSchema.parse({
    id: providerIdFor(parsed.name),
    name: parsed.name,
    category: parsed.category,
    location: parsed.location,
    languages: parsed.languages,
    verified: false,
    active: true
  });

  await sql`
    insert into provider_registry (id, provider, phone, consented, created_at, updated_at)
    values (
      ${provider.id},
      ${JSON.stringify(provider)}::jsonb,
      ${phone},
      true,
      now(),
      now()
    )
  `;

  return provider;
}

export async function listRegisteredProviders(
  filters: RegisteredProviderFilters = {}
): Promise<Provider[]> {
  if (!hasDatabaseConfiguration()) return [];

  const sql = await ensureProviderRegistryTable();
  const rows = (await sql`
    select id, provider, phone, consented
    from provider_registry
    where consented = true
    order by created_at desc
    limit 100
  `) as ProviderRegistryRow[];

  return rows
    .map((row) => providerSchema.parse(row.provider))
    .filter((provider) => matchesFilters(provider, filters));
}

export async function getRegisteredProvider(
  providerId: string
): Promise<Provider | undefined> {
  if (!hasDatabaseConfiguration()) return undefined;

  const sql = await ensureProviderRegistryTable();
  const rows = (await sql`
    select id, provider, phone, consented
    from provider_registry
    where id = ${providerId} and consented = true
    limit 1
  `) as ProviderRegistryRow[];

  const row = rows[0];
  return row ? providerSchema.parse(row.provider) : undefined;
}

export async function getRegisteredProviderPhone(
  providerId: string
): Promise<string | undefined> {
  if (!hasDatabaseConfiguration()) return undefined;

  const sql = await ensureProviderRegistryTable();
  const rows = (await sql`
    select id, provider, phone, consented
    from provider_registry
    where id = ${providerId} and consented = true
    limit 1
  `) as ProviderRegistryRow[];

  const row = rows[0];
  return row?.consented ? e164PhoneSchema.parse(row.phone) : undefined;
}

export async function discoverRegisteredProvidersForMission(
  mission: Mission
): Promise<Provider[]> {
  const providers = await listRegisteredProviders({ active: true });
  return providers.filter((provider) => providerMatchesMissionItem(mission, provider));
}
