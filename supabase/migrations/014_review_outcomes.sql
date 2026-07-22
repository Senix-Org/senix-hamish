-- Migration 014: review outcome tracking
--
-- Captures what happened AFTER each review, turning every analysis into a
-- labeled training example for a future fine-tuned risk model: did the
-- developer merge despite a high-risk verdict, did a hotfix land within 24h
-- of merging, and how many commits were pushed after the review (pushback).
--
-- Recording is best-effort from the webhook handlers and the daily hotfix
-- cron; it never touches the review critical path.
--
-- Run manually in Supabase.

ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS developer_shipped boolean,
  ADD COLUMN IF NOT EXISTS hotfix_detected boolean,
  ADD COLUMN IF NOT EXISTS commits_after_review integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outcome_recorded_at timestamptz,
  ADD COLUMN IF NOT EXISTS pr_merged_at timestamptz,
  ADD COLUMN IF NOT EXISTS pr_closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS hotfix_check_after timestamptz;

COMMENT ON COLUMN analyses.developer_shipped IS
  'True if the PR was merged despite a high/critical risk verdict';
COMMENT ON COLUMN analyses.hotfix_detected IS
  'True if a commit with hotfix/fix:/patch/revert/rollback in the title appeared on the repo default branch within 24h of merge';
COMMENT ON COLUMN analyses.commits_after_review IS
  'Number of commits pushed after Senix posted its review, before the PR was merged — a proxy for developer pushback';
COMMENT ON COLUMN analyses.outcome_recorded_at IS
  'When the outcome data was last recorded';
COMMENT ON COLUMN analyses.hotfix_check_after IS
  'When the daily cron should scan for post-merge hotfix commits; cleared after the scan';

-- The daily hotfix cron scans for due checks; keep that scan off the main
-- table path with a partial index over only the pending rows.
CREATE INDEX IF NOT EXISTS analyses_hotfix_check_after_idx
  ON analyses (hotfix_check_after)
  WHERE hotfix_check_after IS NOT NULL;
