-- Migration 012: atomic monthly token budget operations
--
-- increment_token_usage replaces the read-compare (checkTokenLimit) plus
-- optimistic-locking retry loop (recordTokenUsage) with one atomic
-- check-and-increment: the user row is locked FOR UPDATE, so concurrent
-- reviews cannot all pass the gate and collectively exceed the budget, and
-- no increment is ever lost to a lost optimistic race.
--
-- adjust_token_usage is the post-LLM true-up: once the actual token count is
-- known, usage is corrected by (actual - reserved estimate) in one atomic
-- UPDATE. It never blocks (the spend already happened) and floors at zero.
--
-- Run manually in Supabase.

CREATE OR REPLACE FUNCTION increment_token_usage(
  user_id uuid,
  tokens_to_add integer,
  monthly_limit integer
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  current_usage integer;
  new_usage integer;
BEGIN
  -- Lock the user row for this transaction
  SELECT tokens_used_this_month
  INTO current_usage
  FROM users
  WHERE id = increment_token_usage.user_id
  FOR UPDATE;

  IF current_usage IS NULL THEN
    current_usage := 0;
  END IF;

  -- Check if adding tokens would exceed limit
  IF current_usage + tokens_to_add > monthly_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'current_usage', current_usage,
      'limit', monthly_limit
    );
  END IF;

  -- Atomically increment
  UPDATE users
  SET tokens_used_this_month = COALESCE(tokens_used_this_month, 0) + tokens_to_add
  WHERE id = increment_token_usage.user_id
  RETURNING tokens_used_this_month INTO new_usage;

  RETURN jsonb_build_object(
    'allowed', true,
    'new_usage', new_usage,
    'limit', monthly_limit
  );
END;
$$;

CREATE OR REPLACE FUNCTION adjust_token_usage(
  user_id uuid,
  delta integer
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  new_usage integer;
BEGIN
  UPDATE users
  SET tokens_used_this_month = GREATEST(0, COALESCE(tokens_used_this_month, 0) + delta)
  WHERE id = adjust_token_usage.user_id
  RETURNING tokens_used_this_month INTO new_usage;

  RETURN COALESCE(new_usage, 0);
END;
$$;
