CREATE TABLE IF NOT EXISTS communication_event_claims (
  event_id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
