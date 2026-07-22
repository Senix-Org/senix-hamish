-- Verification script for migration 016 (credit_packs + consume_tokens).
-- Safe to run in the production SQL Editor: everything happens inside a
-- transaction that is ROLLED BACK at the end, so no data survives.
-- Each RAISE NOTICE prints PASS/FAIL; read the Messages tab after running.

BEGIN;

DO $$
DECLARE
  uid uuid := gen_random_uuid();
  r jsonb;
  used bigint;
  small_used bigint;
  large_used bigint;
BEGIN
  -- Fixture: a user with 1,000 monthly tokens already used (limit 10,000),
  -- a small pack expiring SOON and a large pack expiring LATER.
  INSERT INTO users (id, email, plan, plan_status, tokens_used_this_month)
  VALUES (uid, 'consume-tokens-test@example.invalid', 'free', 'active', 1000);

  INSERT INTO credit_packs (user_id, pack, credits, expires_at, whop_payment_id)
  VALUES
    (uid, 'small', 200000, now() + interval '1 month', 'pay_test_small'),
    (uid, 'large', 600000, now() + interval '6 months', 'pay_test_large');

  -- 1. Spend within the monthly budget only.
  r := consume_tokens(uid, 5000, 10000);
  ASSERT (r->>'allowed')::boolean, 'case 1: should be allowed';
  ASSERT (r->>'from_monthly')::bigint = 5000, 'case 1: all from monthly';
  ASSERT (r->>'from_packs')::bigint = 0, 'case 1: none from packs';
  RAISE NOTICE 'PASS 1: monthly-only spend';

  -- 2. Spend that overflows the monthly budget into the oldest-expiring pack.
  -- Monthly remaining is 10000 - 6000 = 4000; ask for 10000.
  r := consume_tokens(uid, 10000, 10000);
  ASSERT (r->>'allowed')::boolean, 'case 2: should be allowed';
  ASSERT (r->>'from_monthly')::bigint = 4000, 'case 2: drain monthly first';
  ASSERT (r->>'from_packs')::bigint = 6000, 'case 2: remainder from packs';
  SELECT credits_used INTO small_used FROM credit_packs
    WHERE user_id = uid AND pack = 'small';
  SELECT credits_used INTO large_used FROM credit_packs
    WHERE user_id = uid AND pack = 'large';
  ASSERT small_used = 6000, 'case 2: oldest-expiring (small) pack drained';
  ASSERT large_used = 0, 'case 2: later pack untouched';
  RAISE NOTICE 'PASS 2: overflow drains oldest-expiring pack first';

  -- 3. Spend spanning both packs. Small has 194,000 left; ask 200,000.
  r := consume_tokens(uid, 200000, 10000);
  ASSERT (r->>'allowed')::boolean, 'case 3: should be allowed';
  ASSERT (r->>'from_monthly')::bigint = 0, 'case 3: monthly exhausted';
  SELECT credits_used INTO small_used FROM credit_packs
    WHERE user_id = uid AND pack = 'small';
  SELECT credits_used INTO large_used FROM credit_packs
    WHERE user_id = uid AND pack = 'large';
  ASSERT small_used = 200000, 'case 3: small pack fully drained';
  ASSERT large_used = 6000, 'case 3: spillover into large pack';
  RAISE NOTICE 'PASS 3: spend spans packs in expiry order';

  -- 4. Insufficient balance: large has 594,000 left; ask 600,000.
  r := consume_tokens(uid, 600000, 10000);
  ASSERT NOT (r->>'allowed')::boolean, 'case 4: should be denied';
  ASSERT r->>'reason' = 'insufficient_tokens', 'case 4: reason';
  SELECT credits_used INTO large_used FROM credit_packs
    WHERE user_id = uid AND pack = 'large';
  ASSERT large_used = 6000, 'case 4: denial consumed nothing';
  RAISE NOTICE 'PASS 4: insufficient balance denies and consumes nothing';

  -- 5. Expired packs are ignored.
  UPDATE credit_packs SET expires_at = now() - interval '1 day'
    WHERE user_id = uid AND pack = 'large';
  r := consume_tokens(uid, 1000, 10000);
  ASSERT NOT (r->>'allowed')::boolean, 'case 5: expired pack must not fund spend';
  RAISE NOTICE 'PASS 5: expired packs ignored';

  -- 6. Unknown user.
  r := consume_tokens(gen_random_uuid(), 1000, 10000);
  ASSERT NOT (r->>'allowed')::boolean AND r->>'reason' = 'user_not_found',
    'case 6: unknown user';
  RAISE NOTICE 'PASS 6: unknown user handled';

  -- 7. Duplicate payment id rejected by the unique constraint.
  BEGIN
    INSERT INTO credit_packs (user_id, pack, credits, whop_payment_id)
    VALUES (uid, 'small', 200000, 'pay_test_small');
    RAISE EXCEPTION 'case 7: duplicate whop_payment_id was accepted';
  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE 'PASS 7: duplicate whop_payment_id rejected';
  END;

  RAISE NOTICE 'ALL PASS';
END $$;

ROLLBACK;
