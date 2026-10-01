-- Durable mapping from SABI communication IDs to external SMS message IDs.
-- Apply to the intended Neon branch before enabling SABI_MESSAGE_MODE=voicebip-temlio.

CREATE TABLE IF NOT EXISTS communication_correlations (
  communication_id text PRIMARY KEY,
  external_id text UNIQUE,
  mission_id text NOT NULL,
  provider_id text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('SMS')),
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS communication_correlations_external_id_idx
  ON communication_correlations (external_id)
  WHERE external_id IS NOT NULL;
