# Auth Setup (Supabase + GitHub OAuth)

The dashboard uses Supabase Auth with GitHub as the only provider. We
reuse the existing GitHub App's OAuth credentials so a user only ever
sees one consent screen ("Authorize Senix"), and the `github_user_id`
returned by Supabase matches the one we already store in `users`.

This is a one-time, manual setup in the Supabase dashboard. Don't try to
script it.

## 1. Enable GitHub provider in Supabase

1. Open the Supabase dashboard for the project.
2. **Authentication → Providers → GitHub**.
3. Toggle **Enable Sign in with GitHub** on.
4. Leave the page open — you'll paste credentials into it in step 3.

## 2. Get the Client ID / Secret from the GitHub App

The GitHub App already has OAuth credentials we can reuse.

1. Go to `https://github.com/organizations/{org}/settings/apps/{app}`
   (replace `{org}` with the org that owns the App and `{app}` with the
   App slug — for Senix, the org is `Senix-Org`).
2. Scroll to **Client ID** — copy it.
3. Click **Generate a new client secret** — copy the secret immediately,
   GitHub only shows it once.

## 3. Paste credentials into Supabase

1. Back in the Supabase GitHub provider panel, paste the Client ID into
   **Client ID (for OAuth)**.
2. Paste the secret into **Client Secret (for OAuth)**.
3. Click **Save**.
4. Copy the **Callback URL** Supabase shows (looks like
   `https://{project-ref}.supabase.co/auth/v1/callback`). You'll need it
   in the next step.

## 4. Whitelist the Supabase callback in the GitHub App

1. Back in the GitHub App settings (same page as step 2).
2. Under **Callback URL**, add the Supabase callback URL from step 3.
   GitHub Apps allow multiple callback URLs — keep any existing entry,
   add a new line for the Supabase one.
3. Tick **Request user authorization (OAuth) during installation** if it
   isn't already on. This is what makes the OAuth flow happen at install
   time so we can link the install to a Supabase user on the
   `/setup` page.
4. Save.

## 5. Set the public env vars

Add to `.env.local` (and to Vercel's project env for prod):

```
NEXT_PUBLIC_SUPABASE_URL=https://{project-ref}.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY={anon-key-from-supabase-settings-api}
```

The existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` stay
unchanged — those drive `supabaseAdmin`.

## 6. Smoke test

1. `npm run dev`.
2. Visit `http://localhost:3000/login`.
3. Click **Sign in with GitHub** → should redirect to GitHub → "Authorize
   Senix" screen → bounce back to `/auth/callback?code=...` → land on
   `/dashboard`.
4. The dashboard layout will redirect you to `/login` if the session
   didn't persist. If that happens, double-check the
   `NEXT_PUBLIC_SUPABASE_*` env vars and that the cookie domain matches
   `localhost`.
