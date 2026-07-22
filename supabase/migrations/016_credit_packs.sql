-- Migration 016: credit packs (one-time token top-ups) + consume_tokens RPC
--
-- credit_packs stores one row per purchased top-up ($10 = 200k tokens,
-- $25 = 600k). The Whop webhook inserts rows (service role); the UNIQUE
-- constraint on whop_payment_id makes the grant idempotent per payment even
-- if event-id dedup ever misses a retry.
--
-- consume_tokens is the single spend path: it drains the user's monthly
-- budget first, then non-expired credit packs oldest-expiring first, in one
-- atomic transaction. The user row lock (FOR UPDATE) serializes all
-- concurrent consumption for a user, so the availability check and the
-- drain cannot race.
--
-- Numbering note: there is no migration 015; numbered 016 per project owner.
-- Run manually in Supabase.

-- 1. Table ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS credit_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pack TEXT NOT NULL CHECK (pack IN ('small', 'large')),
  credits BIGINT NOT NULL CHECK (credits > 0),
  credits_used BIGINT NOT NULL DEFAULT 0,
  price_usd NUMERIC(10, 2),
  whop_event_id TEXT,
  whop_payment_id TEXT,
  -- Packs expire 12 months after purchase. Intentional, confirmed 2026-07-17:
  -- mirrors Anthropic's own API credit expiry policy. Not a placeholder.
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '12 months',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT credit_packs_used_within_bounds
    CHECK (credits_used >= 0 AND credits_used <= credits),
  -- Payment-level idempotency; the webhook treats a unique violation as
  -- "already granted". NULLs (payments without an id) are not deduplicated.
  CONSTRAINT credit_packs_whop_payment_id_unique UNIQUE (whop_payment_id)
);

CREATE INDEX IF NOT EXISTS idx_credit_packs_user_expiry
  ON credit_packs (user_id, expires_at);

-- 2. RLS: same pattern as the billing columns. Writes go through the
-- service role only (no INSERT/UPDATE/DELETE policies). Users may read
-- their own packs so the dashboard can show a balance.

ALTER TABLE credit_packs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS credit_packs_owner_select ON credit_packs;
CREATE POLICY credit_packs_owner_select ON credit_packs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = credit_packs.user_id
        AND u.auth_user_id = auth.uid()
    )
  );

-- 3. consume_tokens RPC ----------------------------------------------------

CREATE OR REPLACE FUNCTION consume_tokens(
  user_id uuid,
  tokens_to_consume bigint,
  monthly_limit bigint
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  current_usage bigint;
  monthly_remaining bigint;
  from_monthly bigint;
  remainder bigint;
  total_pack_available bigint;
  pack RECORD;
  take bigint;
BEGIN
  IF tokens_to_consume <= 0 THEN
    RETURN jsonb_build_object('allowed', true, 'from_monthly', 0, 'from_packs', 0);
  END IF;

  -- Lock the user row: serializes every concurrent consume for this user,
  -- so the availability check below cannot race another spend.
  SELECT COALESCE(tokens_used_this_month, 0)
  INTO current_usage
  FROM users
  WHERE id = consume_tokens.user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'user_not_found');
  END IF;

  monthly_remaining := GREATEST(0, monthly_limit - current_usage);
  from_monthly := LEAST(monthly_remaining, tokens_to_consume);
  remainder := tokens_to_consume - from_monthly;

  IF remainder > 0 THEN
    SELECT COALESCE(SUM(credits - credits_used), 0)
    INTO total_pack_available
    FROM credit_packs
    WHERE credit_packs.user_id = consume_tokens.user_id
      AND expires_at > now()
      AND credits_used < credits;

    IF total_pack_available < remainder THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'insufficient_tokens',
        'monthly_remaining', monthly_remaining,
        'pack_remaining', total_pack_available
      );
    END IF;
  END IF;

  IF from_monthly > 0 THEN
    UPDATE users
    SET tokens_used_this_month = COALESCE(tokens_used_this_month, 0) + from_monthly
    WHERE id = consume_tokens.user_id;
  END IF;

  -- Drain packs oldest-expiring first.
  WHILE remainder > 0 LOOP
    SELECT id, credits - credits_used AS available
    INTO pack
    FROM credit_packs
    WHERE credit_packs.user_id = consume_tokens.user_id
      AND expires_at > now()
      AND credits_used < credits
    ORDER BY expires_at ASC, created_at ASC
    LIMIT 1;

    EXIT WHEN NOT FOUND;

    take := LEAST(pack.available, remainder);
    UPDATE credit_packs SET credits_used = credits_used + take WHERE id = pack.id;
    remainder := remainder - take;
  END LOOP;

  IF remainder > 0 THEN
    -- Unreachable while all consumers hold the user row lock; abort loudly
    -- (rolls back the partial drain) rather than under-charge silently.
    RAISE EXCEPTION 'consume_tokens: % tokens unaccounted for user %',
      remainder, consume_tokens.user_id;
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'from_monthly', from_monthly,
    'from_packs', tokens_to_consume - from_monthly
  );
END;
$$;
