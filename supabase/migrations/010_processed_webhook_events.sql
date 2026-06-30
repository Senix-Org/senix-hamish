-- Migration 010: webhook idempotency ledger
--
-- Whop retries webhook deliveries on timeout or non-2xx responses, so the same
-- event id can arrive more than once. The Whop webhook handler records each
-- processed event id here and skips anything already present. Run manually in
-- Supabase.

CREATE TABLE IF NOT EXISTS processed_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Writes happen only from the service-role webhook handler. Enable RLS with no
-- policies so the anon/authenticated roles have no access.
ALTER TABLE processed_webhook_events ENABLE ROW LEVEL SECURITY;
