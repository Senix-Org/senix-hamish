-- Migration 009: token-based usage limits
--
-- Replaces the review-count rate limiting with a single monthly token
-- budget per user, and adds a token-based limiter for the anonymous
-- playground (10,000 tokens per IP per 24h). Run manually in Supabase.

-- 1. Per-user monthly token budget -------------------------------------------

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tokens_used_this_month BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_reset_at TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now());

-- Carry the old reset timestamp forward if it exists, then drop the
-- review-count columns now that usage is metered in tokens.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'reviews_reset_at'
  ) THEN
    UPDATE users SET tokens_reset_at = reviews_reset_at;
  END IF;
END $$;

ALTER TABLE users
  DROP COLUMN IF EXISTS pr_reviews_this_month,
  DROP COLUMN IF EXISTS mcp_reviews_this_month,
  DROP COLUMN IF EXISTS reviews_reset_at;

-- Old non-negativity check referenced the dropped review columns.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_review_counts_nonnegative_check;

DO $$
BEGIN
  ALTER TABLE users
    ADD CONSTRAINT users_tokens_used_nonnegative_check
    CHECK (tokens_used_this_month >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Anonymous playground token limiter (10,000 tokens / IP / 24h) ------------

CREATE TABLE IF NOT EXISTS playground_token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  tokens BIGINT NOT NULL DEFAULT 0,
  UNIQUE (ip_hash, window_start)
);

ALTER TABLE playground_token_usage ENABLE ROW LEVEL SECURITY;

-- Read the current 24h-window token total for an IP (0 when no row yet).
CREATE OR REPLACE FUNCTION get_playground_token_usage(
  p_ip_hash TEXT,
  p_window_start TIMESTAMPTZ
) RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  used BIGINT;
BEGIN
  SELECT tokens INTO used
  FROM playground_token_usage
  WHERE ip_hash = p_ip_hash AND window_start = p_window_start;
  RETURN COALESCE(used, 0);
END;
$$;

-- Atomically add tokens to an IP's current window and return the new total.
CREATE OR REPLACE FUNCTION increment_playground_token_usage(
  p_ip_hash TEXT,
  p_window_start TIMESTAMPTZ,
  p_tokens BIGINT
) RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  new_total BIGINT;
BEGIN
  INSERT INTO playground_token_usage (ip_hash, window_start, tokens)
  VALUES (p_ip_hash, p_window_start, p_tokens)
  ON CONFLICT (ip_hash, window_start)
  DO UPDATE SET tokens = playground_token_usage.tokens + p_tokens
  RETURNING tokens INTO new_total;

  RETURN new_total;
END;
$$;
