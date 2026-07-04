# GitHub App Configuration
   
   ## Identity
   - **App name:** [Project Name] (must be globally unique on GitHub)
   - **Homepage URL:** https://senix.dev
   - **Description:** Translates AI-generated pull requests into plain-English behavioral summaries.
   
   ## URLs
   - **Webhook URL:** https://senix.dev/api/webhooks/github
   - **Callback URL (OAuth):** `https://{project-ref}.supabase.co/auth/v1/callback` —
     Supabase Auth handles the GitHub OAuth round-trip on our behalf, so the
     GitHub App's OAuth callback must point at the Supabase project, not at
     our Next.js app. Whitelist this URL on the GitHub App settings page
     (GitHub Apps allow multiple callbacks; keep any existing entries).
     The Supabase callback URL appears in the Supabase dashboard under
     Authentication → Providers → GitHub once the provider is enabled.
     Full setup steps: see `docs/auth-setup.md`.
   - **Setup URL (post-install):** `https://senix.dev/setup` — and
     **tick "Redirect on update"** so updates to an existing install also
     bounce the user through `/setup`. This is the page where we link the
     installation to the signed-in Supabase user.
   
   ## Permissions (Repository)
   - Contents: Read (to fetch PR diffs)
   - Pull requests: Read & Write (to read PRs and post comment summaries)
   - Metadata: Read (mandatory)
   - Checks: Read & Write (to surface analysis as a check run — Day 11+)
   
   ## Permissions (Account)
   - Email addresses: Read (for account linking)
   
   ## Subscribed Events
   - Pull request
   - Pull request review
   - Installation
   - Installation repositories
   
   ## Where can this GitHub App be installed?
   - Any account (so external users can install it later)