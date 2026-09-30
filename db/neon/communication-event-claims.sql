-- Durable idempotency claims for authenticated communication webhook events.
-- Raw webhook bodies, signatures, transcripts and provider payloads are not stored here.
-- A retained row means the event has already been accepted for processing.

create table if not exists communication_event_claims (
  event_id text primary key,
  claimed_at timestamptz not null default now()
);

create index if not exists communication_event_claims_claimed_at_idx
  on communication_event_claims (claimed_at);
