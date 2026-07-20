-- Migration 017: affiliate referral tracking + admin dashboard metrics RPC
--
-- Affiliates (YouTubers) get a code used in senix.dev/yt/{code} links. A
-- signup through that link stamps users.referred_by_affiliate_id (first-touch,
-- set once). On the referred user's FIRST successful subscription payment
-- (billing_reason 'subscription_create'), 10% of the payment lands in
-- affiliate_commissions. Idempotency is structural, same pattern as
-- credit_packs: UNIQUE whop_payment_id (payment-level) plus UNIQUE user_id
-- (one commission per referred user, ever — "first payment only" cannot be
-- violated even by a mis-tagged renewal).
--
-- admin_dashboard_metrics() aggregates every /internal/metrics number in one
-- SQL round trip (no N+1 from the page).
--
-- All writes are service-role only (RLS enabled, no write policies).
-- Run manually in Supabase.

-- 1. Affiliates -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The public code in senix.dev/yt/{code}. Lowercase alphanumeric + dashes.
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9-]{2,40}$'),
  name TEXT NOT NULL,
  -- Payout contact (email / PayPal / etc). Free text for now.
  payout_contact TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
-- No policies: reads and writes go through the service role only.

-- 2. Attribution column on users -------------------------------------------

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referred_by_affiliate_id UUID REFERENCES affiliates(id);

CREATE INDEX IF NOT EXISTS users_referred_by_affiliate_idx
  ON users (referred_by_affiliate_id)
  WHERE referred_by_affiliate_id IS NOT NULL;

-- 3. Commission ledger ------------------------------------------------------

CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id),
  user_id UUID NOT NULL REFERENCES users(id),
  -- Payment-level idempotency: a retried webhook can never double-insert.
  whop_payment_id TEXT NOT NULL UNIQUE,
  -- "First payment only" as a constraint, not just code: one commission per
  -- referred user for all time.
  CONSTRAINT affiliate_commissions_one_per_user UNIQUE (user_id),
  payment_amount_cents INTEGER NOT NULL CHECK (payment_amount_cents >= 0),
  commission_cents INTEGER NOT NULL CHECK (commission_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS affiliate_commissions_affiliate_idx
  ON affiliate_commissions (affiliate_id, status);

ALTER TABLE affiliate_commissions ENABLE ROW LEVEL SECURITY;
-- No policies: service-role only, same as credit_packs writes.

-- 4. Admin dashboard metrics RPC --------------------------------------------

CREATE OR REPLACE FUNCTION admin_dashboard_metrics()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'signups_today', (
      SELECT count(*) FROM users
      WHERE created_at >= date_trunc('day', now())
    ),
    'signups_week', (
      SELECT count(*) FROM users
      WHERE created_at >= now() - interval '7 days'
    ),
    'users_total', (SELECT count(*) FROM users),
    'users_by_plan', (
      SELECT COALESCE(jsonb_object_agg(plan, cnt), '{}'::jsonb)
      FROM (
        SELECT plan, count(*) AS cnt FROM users GROUP BY plan
      ) p
    ),
    'paying_active_by_plan', (
      SELECT COALESCE(jsonb_object_agg(plan, cnt), '{}'::jsonb)
      FROM (
        SELECT plan, count(*) AS cnt FROM users
        WHERE plan <> 'free' AND plan_status = 'active'
        GROUP BY plan
      ) p
    ),
    -- MRR in cents from ACTIVE paid users x current monthly list price.
    -- Prices mirror PAID_PLAN_DETAILS in features/billing/whop.ts (starter
    -- $18, team $79, pro $199); update both together on a price change.
    'mrr_cents', (
      SELECT COALESCE(sum(
        CASE plan
          WHEN 'starter' THEN 1800
          WHEN 'team' THEN 7900
          WHEN 'pro' THEN 19900
          ELSE 0
        END), 0)
      FROM users
      WHERE plan <> 'free' AND plan_status = 'active'
    ),
    'reviews_total', (SELECT count(*) FROM analyses),
    'reviews_today', (
      SELECT count(*) FROM analyses
      WHERE created_at >= date_trunc('day', now())
    ),
    'reviews_failed_total', (
      SELECT count(*) FROM analyses WHERE status = 'failed'
    ),
    'reviews_24h', (
      SELECT count(*) FROM analyses
      WHERE created_at >= now() - interval '24 hours'
    ),
    'reviews_failed_24h', (
      SELECT count(*) FROM analyses
      WHERE status = 'failed' AND created_at >= now() - interval '24 hours'
    ),
    -- Completed rows whose LLM produced nothing (risk_level NULL): a distinct
    -- "errored" bucket so dashboards never show them as healthy completions.
    'reviews_errored_total', (
      SELECT count(*) FROM analyses
      WHERE status = 'completed' AND risk_level IS NULL
    ),
    'credit_revenue_cents', (
      SELECT COALESCE(round(sum(price_usd) * 100)::bigint, 0) FROM credit_packs
    ),
    'credit_packs_sold', (SELECT count(*) FROM credit_packs),
    'commissions_unpaid_cents', (
      SELECT COALESCE(sum(commission_cents), 0)
      FROM affiliate_commissions WHERE status = 'unpaid'
    ),
    'commissions_total_cents', (
      SELECT COALESCE(sum(commission_cents), 0) FROM affiliate_commissions
    )
  );
$$;
