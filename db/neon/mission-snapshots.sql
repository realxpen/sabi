create table if not exists mission_snapshots (
  id text primary key,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mission_snapshots_updated_at_idx
  on mission_snapshots (updated_at desc);
