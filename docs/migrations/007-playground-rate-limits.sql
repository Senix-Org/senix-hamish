-- Migration 007: playground rate limits
--
-- Backs the public playground (/api/playground/review). The playground
-- runs without auth, so it is limited by IP address: 5 requests per IP
-- per hour. Each row counts requests for one IP in one hourly window.
--
-- Serverless functions cannot share an in-memory counter across cold
-- starts, so the counter lives here. Raw IPs are never stored, only their
-- SHA-256 hash.
--
-- The playground route uses `supabaseAdmin` (service role), which bypasses
-- RLS. RLS is enabled with no policies so the table is unreachable from
-- the anon and authenticated roles.
--
-- Run in the Supabase SQL editor.

CREATE TABLE playground_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (ip_hash, window_start)
);

ALTER TABLE playground_rate_limits ENABLE ROW LEVEL SECURITY;

-- Atomically count one request for an IP in the current hourly window and
-- return the new total. The INSERT ... ON CONFLICT ... DO UPDATE runs as a
-- single statement, so two concurrent requests cannot both read a stale
-- count and both slip past the limit when it is sitting at 4.
CREATE OR REPLACE FUNCTION increment_playground_rate_limit(
  p_ip_hash TEXT,
  p_window_start TIMESTAMPTZ
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  INSERT INTO playground_rate_limits (ip_hash, window_start, count)
  VALUES (p_ip_hash, p_window_start, 1)
  ON CONFLICT (ip_hash, window_start)
  DO UPDATE SET count = playground_rate_limits.count + 1
  RETURNING count INTO new_count;

  RETURN new_count;
END;
$$;
