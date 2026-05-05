-- Migration 003: Tighten RLS policies for the customer dashboard
--
-- The dashboard reads analyses, pull_requests, and repositories through a
-- user-context Supabase client, so RLS is now in the request path. The
-- existing policies on users / installations / repositories were
-- placeholder "anyone authenticated" rules; pull_requests and analyses
-- had RLS enabled with no policies (i.e. user-context reads returned
-- empty). This migration replaces them with a coherent set that joins
-- ownership through `installations.installed_by_user_id`.
--
-- Service role bypasses RLS automatically — the worker, the webhook
-- handlers, and any `supabaseAdmin` call keep working without explicit
-- service-role policies.
--
-- Run in the Supabase SQL editor.

-- =========================================================================
-- users
-- =========================================================================

DROP POLICY IF EXISTS users_select_self ON users;
DROP POLICY IF EXISTS users_update_self ON users;
DROP POLICY IF EXISTS users_authenticated_read ON users;
DROP POLICY IF EXISTS users_authenticated_write ON users;

CREATE POLICY users_select_self ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_user_id);

CREATE POLICY users_update_self ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

-- =========================================================================
-- installations
-- =========================================================================

DROP POLICY IF EXISTS installations_select_owner ON installations;
DROP POLICY IF EXISTS installations_authenticated_read ON installations;
DROP POLICY IF EXISTS installations_authenticated_write ON installations;

CREATE POLICY installations_select_owner ON installations
  FOR SELECT
  TO authenticated
  USING (
    installed_by_user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- =========================================================================
-- repositories
-- =========================================================================

DROP POLICY IF EXISTS repositories_select_owner ON repositories;
DROP POLICY IF EXISTS repositories_update_enabled ON repositories;
DROP POLICY IF EXISTS repositories_authenticated_read ON repositories;
DROP POLICY IF EXISTS repositories_authenticated_write ON repositories;

CREATE POLICY repositories_select_owner ON repositories
  FOR SELECT
  TO authenticated
  USING (
    installation_id IN (
      SELECT i.id
      FROM installations i
      JOIN users u ON u.id = i.installed_by_user_id
      WHERE u.auth_user_id = auth.uid()
    )
  );

-- Users can only flip the `enabled` flag. We can't restrict columns at
-- the policy level, but `WITH CHECK` confirms ownership on the new row;
-- the application layer (toggleRepoEnabled action) only ever sets
-- `enabled`.
CREATE POLICY repositories_update_enabled ON repositories
  FOR UPDATE
  TO authenticated
  USING (
    installation_id IN (
      SELECT i.id
      FROM installations i
      JOIN users u ON u.id = i.installed_by_user_id
      WHERE u.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    installation_id IN (
      SELECT i.id
      FROM installations i
      JOIN users u ON u.id = i.installed_by_user_id
      WHERE u.auth_user_id = auth.uid()
    )
  );

-- =========================================================================
-- pull_requests
-- =========================================================================

DROP POLICY IF EXISTS pull_requests_select_owner ON pull_requests;

CREATE POLICY pull_requests_select_owner ON pull_requests
  FOR SELECT
  TO authenticated
  USING (
    repository_id IN (
      SELECT r.id
      FROM repositories r
      JOIN installations i ON i.id = r.installation_id
      JOIN users u ON u.id = i.installed_by_user_id
      WHERE u.auth_user_id = auth.uid()
    )
  );

-- =========================================================================
-- analyses
-- =========================================================================

DROP POLICY IF EXISTS analyses_select_owner ON analyses;

CREATE POLICY analyses_select_owner ON analyses
  FOR SELECT
  TO authenticated
  USING (
    pull_request_id IN (
      SELECT pr.id
      FROM pull_requests pr
      JOIN repositories r ON r.id = pr.repository_id
      JOIN installations i ON i.id = r.installation_id
      JOIN users u ON u.id = i.installed_by_user_id
      WHERE u.auth_user_id = auth.uid()
    )
  );
