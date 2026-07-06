-- Migration 013: webhook delivery idempotency constraints
--
-- The webhook idempotency claim (features/webhook/idempotency.ts) relies on
-- the INSERT of a delivery id failing with a unique violation when a
-- concurrent or earlier delivery already claimed it. docs/schema.md lists
-- github_delivery_id as unique, but the early migrations are not in the
-- repo, so this makes the constraint explicit and idempotent to apply.
--
-- Also adds processed_at, stamped when processing completes.
--
-- Run manually in Supabase.

CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_github_delivery_id_key
  ON webhook_events (github_delivery_id);

ALTER TABLE webhook_events
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;
