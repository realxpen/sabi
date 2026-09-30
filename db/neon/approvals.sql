-- SABI durable Approval storage for Neon/Postgres.
-- Canonical domain validation remains in lib/schemas/approval.ts.
-- Apply db/neon/quotes.sql before this file when adding the optional quote FK.

create table if not exists approvals (
  id text primary key,
  mission_id text not null,
  action text not null check (action = 'SELECT_PROVIDER'),
  provider_id text not null,
  quote_id text not null,
  status text not null check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  created_at timestamptz not null
);

create unique index if not exists approvals_pending_quote_idx
  on approvals (quote_id)
  where status = 'PENDING';

create index if not exists approvals_mission_id_idx on approvals (mission_id);
create index if not exists approvals_provider_id_idx on approvals (provider_id);
create index if not exists approvals_quote_id_idx on approvals (quote_id);
