-- Migration 004: Soft-delete installations
--
-- Day 10 hardening: previously, an `installation.deleted` webhook hard-deleted
-- the installation row and cascade-deleted every repository, pull_request, and
-- analysis owned by it. That is dangerous for design partners — uninstalling
-- to "try again" wipes their history.
--
-- New behavior: on uninstall we stamp `uninstalled_at` and leave all child
-- rows in place. Re-installing the same `github_installation_id` clears the
-- timestamp so the installation reactivates with its history intact.
--
-- Run in the Supabase SQL editor.

ALTER TABLE installations
  ADD COLUMN IF NOT EXISTS uninstalled_at TIMESTAMPTZ;

-- Index supports the "active installations only" filter used by the worker
-- gate and the customer dashboard. Partial index keeps it tiny.
CREATE INDEX IF NOT EXISTS installations_uninstalled_at_idx
  ON installations (uninstalled_at)
  WHERE uninstalled_at IS NULL;
