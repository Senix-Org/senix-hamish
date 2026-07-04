# Database Schema (v1)
   
   ## Tables
   
   ### users
   Linked to Supabase Auth via `auth_user_id`.
   - `id` (uuid, primary key, default `gen_random_uuid()`)
   - `auth_user_id` (uuid, unique, references `auth.users(id)`)
   - `github_username` (text)
   - `github_user_id` (bigint, unique)
   - `email` (text)
   - `created_at` (timestamptz, default `now()`)
   
   ### installations
   One row per GitHub App install (a user/org installs the app on their account).
   - `id` (uuid, primary key)
   - `github_installation_id` (bigint, unique) — provided by GitHub
   - `account_login` (text) — e.g. `octocat`
   - `account_type` (text) — `User` or `Organization`
   - `installed_by_user_id` (uuid, references `users(id)`)
   - `suspended` (boolean, default false)
   - `created_at` (timestamptz, default `now()`)
   
   ### repositories
   Repos that the installation has access to.
   - `id` (uuid, primary key)
   - `installation_id` (uuid, references `installations(id)`)
   - `github_repo_id` (bigint, unique)
   - `full_name` (text) — e.g. `octocat/hello-world`
   - `private` (boolean)
   - `default_branch` (text)
   - `enabled` (boolean, default true) — user can toggle analysis off per repo
   - `created_at` (timestamptz, default `now()`)
   
   ### pull_requests
   Cached PR metadata so we don't refetch on every event.
   - `id` (uuid, primary key)
   - `repository_id` (uuid, references `repositories(id)`)
   - `github_pr_number` (integer)
   - `github_pr_id` (bigint, unique)
   - `title` (text)
   - `author_login` (text)
   - `state` (text) — `open`, `closed`, `merged`
   - `head_sha` (text)
   - `base_sha` (text)
   - `created_at` (timestamptz, default `now()`)
   - `updated_at` (timestamptz, default `now()`)
   - Unique constraint: `(repository_id, github_pr_number)`
   
   ### analyses
   One row per analysis run. A PR can have many analyses (one per commit).
   - `id` (uuid, primary key)
   - `pull_request_id` (uuid, references `pull_requests(id)`)
   - `commit_sha` (text)
   - `status` (text) — `queued`, `running`, `completed`, `failed`
   - `summary` (text) — the plain-English behavioral summary
   - `risk_level` (text) — `low`, `medium`, `high`
   - `risk_flags` (jsonb) — metadata bag for the analysis. Keys include the structural-diff metadata (`file_count`, `supported_file_count`, `additions`, `deletions`, `symbol_changes`, `structural_diff`, `sample_files`) and `detected_risks` (string array of short kebab-case risk labels produced by the LLM).
   - `focus_areas` (jsonb) — files/lines the reviewer should focus on
   - `tokens_used` (integer)
   - `cost_usd_cents` (integer) — track spend per analysis
   - `error_message` (text, nullable)
   - `created_at` (timestamptz, default `now()`)
   - `completed_at` (timestamptz, nullable)
   
   ### webhook_events
   Audit log of every webhook we receive. Critical for debugging.
   - `id` (uuid, primary key)
   - `github_delivery_id` (text, unique) — GitHub's delivery UUID
   - `event_type` (text) — e.g. `pull_request`
   - `action` (text) — e.g. `opened`, `synchronize`
   - `payload` (jsonb) — full raw payload
   - `signature_valid` (boolean)
   - `processed` (boolean, default false)
   - `received_at` (timestamptz, default `now()`)

   ### processed_webhook_events
   Idempotency ledger for Whop webhooks (migration 010). Whop retries deliveries
   on timeout or non-2xx, so the handler records each processed event id here
   and skips duplicates.
   - `event_id` (text, primary key) — Whop webhook event id
   - `event_type` (text) — e.g. `membership.activated`
   - `processed_at` (timestamptz, default `now()`)
   
   ## Indexes
   - `installations(github_installation_id)`
   - `repositories(installation_id)`, `repositories(github_repo_id)`
   - `pull_requests(repository_id, github_pr_number)`
   - `analyses(pull_request_id)`, `analyses(status)`
   - `webhook_events(github_delivery_id)`, `webhook_events(processed)`
   
   ## Row-Level Security (RLS)
   - All tables have RLS enabled.
   - Users can only see their own installations, repos, PRs, and analyses (joined via `installations.installed_by_user_id`).
   - Service role (used by the worker) bypasses RLS.