-- Migration 005: Feedback submissions
--
-- Replaces the mailto:feedback@senix.app handoff with an in-app form
-- that writes here. The server action runs through the service role,
-- so the RLS policies below are belt-and-suspenders for any future
-- user-context reads (e.g. "your previous submissions" panel).
--
-- Run in the Supabase SQL editor.

CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('bug', 'feature', 'question', 'other')),
  message TEXT NOT NULL,
  page_url TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY feedback_insert_self ON feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- Users can see their own feedback
CREATE POLICY feedback_select_self ON feedback
  FOR SELECT
  TO authenticated
  USING (
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

CREATE INDEX feedback_status_created_idx ON feedback (status, created_at DESC);
