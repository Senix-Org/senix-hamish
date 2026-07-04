# Deploying Senix on Cloudflare Workers

Senix runs on Cloudflare Workers through the OpenNext adapter
(@opennextjs/cloudflare). This replaces the old Vercel deployment. Cloudflare
bills CPU time rather than wall-clock time, so long LLM waits in analyze-pr no
longer hit a platform timeout.

## How deploys work

1. All builds and deploys run in GitHub Actions on Linux
   (`.github/workflows/deploy.yml`). OpenNext has known build issues on
   Windows, so never deploy from a local Windows machine.
2. Every PR into `main` runs tests plus an OpenNext build as a check.
3. Every push to `main` builds and deploys with `npm run deploy`.

## One-time manual setup (dashboards)

### GitHub repository secrets (Settings, Secrets and variables, Actions)

1. `CLOUDFLARE_API_TOKEN`. Create in the Cloudflare dashboard: My Profile,
   API Tokens, Create Token, use the "Edit Cloudflare Workers" template.
2. `CLOUDFLARE_ACCOUNT_ID`. Found in the Cloudflare dashboard right sidebar
   under "Account ID".
3. `CRON_SECRET`. Same value as the Worker secret of the same name; used by
   `.github/workflows/cron-reconcile.yml` to trigger the daily subscription
   reconciliation (this replaces the Vercel cron that lived in vercel.json).

### Cloudflare Worker secrets (Workers & Pages, senix, Settings, Variables and Secrets)

Add every server-side variable from `.env.example` as an encrypted secret:

1. `SUPABASE_URL`
2. `SUPABASE_SERVICE_ROLE_KEY`
3. `GITHUB_APP_ID`
4. `GITHUB_APP_PRIVATE_KEY`
5. `GITHUB_WEBHOOK_SECRET`
6. `LLM_PROVIDER`
7. `DEEPSEEK_API_KEY`
8. `GROQ_API_KEY`
9. `GEMINI_API_KEY`
10. `ANTHROPIC_API_KEY`
11. `UPSTASH_REDIS_REST_URL`
12. `UPSTASH_REDIS_REST_TOKEN`
13. `INTERNAL_WORKER_SECRET`
14. `INTERNAL_PASSWORD`
15. `CRON_SECRET`
16. `POST_PR_COMMENTS`
17. `WHOP_API_KEY`
18. `WHOP_WEBHOOK_SECRET`
19. `WHOP_COMPANY_ID`
20. `WHOP_STARTER_MONTHLY_ID`, `WHOP_STARTER_YEARLY_ID`,
    `WHOP_TEAM_MONTHLY_ID`, `WHOP_TEAM_YEARLY_ID`,
    `WHOP_PRO_MONTHLY_ID`, `WHOP_PRO_YEARLY_ID`
21. `WHOP_STARTER_PRODUCT_ID`, `WHOP_TEAM_PRODUCT_ID`, `WHOP_PRO_PRODUCT_ID`

### Cloudflare build variables versus secrets

The `NEXT_PUBLIC_*` variables are inlined at build time, and the build happens
in GitHub Actions, not in Cloudflare. Set them as GitHub Actions variables or
repository secrets so they are present during `npm run deploy`:

1. `NEXT_PUBLIC_APP_URL=https://senix.dev`
2. `NEXT_PUBLIC_SITE_URL=https://senix.dev`
3. `NEXT_PUBLIC_SUPABASE_URL`
4. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. `NEXT_PUBLIC_GITHUB_APP_SLUG`
6. `NEXT_PUBLIC_WHOP_APP_ID`

### Custom domain (Workers & Pages, senix, Settings, Domains & Routes)

senix.dev is already registered and its DNS is managed by Cloudflare.

1. Open Workers & Pages, senix, Settings, Domains & Routes.
2. Click Add, choose Custom Domain, enter `senix.dev`, confirm. Cloudflare
   creates the DNS record and certificate automatically. If an old DNS record
   still points at Vercel (CNAME to cname.vercel-dns.com), delete it first.
3. Repeat for `www.senix.dev`.

### External webhooks (verify, should already point at senix.dev)

1. GitHub App webhook URL: https://senix.dev/api/webhooks/github
2. GitHub App callback URL: https://senix.dev/api/auth/github/callback
3. Whop webhook URL: https://senix.dev/api/webhooks/whop

## Local development

1. `npm run dev` still uses next dev (with the OpenNext dev initializer in
   next.config.ts so Cloudflare bindings are emulated).
2. `npm run preview` builds with OpenNext and serves in the real Workers
   runtime (workerd). Variables come from `.dev.vars`, which must be kept in
   sync with `.env.local` by hand. Note: OpenNext builds are unreliable on
   Windows; if `npm run preview` fails locally, rely on the CI build check.

## Known limitations on Workers

1. tree-sitter is a native Node addon and cannot load in the Workers runtime.
   `features/ai-engine/parser.ts` guards the load; on Workers the structural
   diff degrades to no symbol detail. The standalone Node worker (`worker/`)
   and local next dev keep the full parser. Follow-up: port to web-tree-sitter
   (WASM) to restore symbol detail on Workers.
2. There is no filesystem at runtime. Do not add code that reads or writes
   local disk in request handlers.
3. The compressed Worker bundle must stay under 10 MB on the paid plan. The
   CI build prints the bundle size on deploy.
