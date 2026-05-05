-- Migration 002: Add PR comment tracking to analyses
--
-- We post the analysis as a comment on the source PR. On subsequent pushes
-- to the same PR we want to UPDATE the existing comment instead of spamming
-- a new one. To do that we record the GitHub comment id (and its html url
-- for the dashboard link) on the analysis row that produced it, then look
-- up the most recent prior comment id when the next analysis runs.
--
-- Both columns are nullable: comment posting is gated behind POST_PR_COMMENTS
-- and may be skipped or fail without failing the analysis itself.
--
-- Run in Supabase SQL editor.

ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS github_comment_id BIGINT,
  ADD COLUMN IF NOT EXISTS github_comment_url TEXT;

-- Index supports the "find the most recent comment id for this PR" lookup
-- the worker performs before every upsert.
CREATE INDEX IF NOT EXISTS analyses_pr_comment_idx
  ON analyses (pull_request_id, github_comment_id);
