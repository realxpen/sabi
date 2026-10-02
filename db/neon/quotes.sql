-- SABI durable Quote storage for Neon/Postgres.
-- Canonical domain validation remains in lib/schemas/quote.ts.
-- This table intentionally has no foreign keys yet because Mission/Provider
-- persistence is not established on this branch.

create table if not exists quotes (
  id text primary key,
  mission_id text not null,
  provider_id text not null,
  available boolean not null,
  quantity numeric check (quantity is null or quantity > 0),
  unit text,
  price numeric check (price is null or price >= 0),
  delivery_fee numeric check (delivery_fee is null or delivery_fee >= 0),
  total numeric check (total is null or total >= 0),
  delivery_date text,
  notes text,
  source text not null check (source in ('CALL', 'SMS', 'MANUAL', 'OTHER')),
  source_reference text,
  created_at timestamptz not null
);

-- Safe upgrade path for deployments created before Quote quantity/unit existed.
alter table quotes
  add column if not exists quantity numeric check (quantity is null or quantity > 0);
alter table quotes
  add column if not exists unit text;

create index if not exists quotes_mission_id_idx on quotes (mission_id);
create index if not exists quotes_provider_id_idx on quotes (provider_id);
create index if not exists quotes_source_reference_idx on quotes (source_reference)
  where source_reference is not null;
