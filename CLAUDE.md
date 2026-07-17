# Senix

Senix is a GitHub App that posts AI-generated risk/behavior summaries on pull requests.

## Stack

Next.js (App Router) on Cloudflare Workers via @opennextjs/cloudflare · Supabase (Postgres + RLS + auth) · Upstash Redis (queue, kept as fallback) · DeepSeek (primary LLM, with Groq/Gemini/Anthropic providers) · tree-sitter (structural diff; native addon, so no symbol detail in the Workers runtime).

## Architecture

GitHub webhook → `/api/webhooks/github` → `handlePullRequest` upserts PR + analysis rows → analysis dispatched via `after()` (runs after the 200 response; Workers bills CPU time only, so long LLM waits are fine) → fetches diff, builds structural diff, calls LLM, updates Supabase, posts/updates PR comment. The standalone Node worker (`worker/`) polls Redis and is an optional fallback only. Builds and deploys go through GitHub Actions (`.github/workflows/deploy.yml`); OpenNext builds are unreliable on Windows, so do not deploy locally.

## Key files

- LLM dispatcher + providers: `src/lib/llm/`
- Prompts: `src/lib/prompts/`
- Structural diff: `src/lib/structural-diff.ts`
- Webhook entry: `src/app/api/webhooks/github/route.ts`
- Analyze function: `src/app/api/internal/analyze-pr/route.ts`
- Shared analysis logic: `worker/handlers/analyze-pr.ts`
- Eval framework: `scripts/run-eval.ts`
- Schema docs: `docs/schema.md`

## Conventions

TypeScript strict mode · kebab-case filenames · `@/` aliases `src/`.

# VERIFICATION LOG

Standing rule: after completing a task, append a short dated entry here (or update the
relevant section) with what was done, what was found, and what is still open. Do not
rewrite the whole file.

## Phase 1 — Subscription Lifecycle Verification (2026-07-16)

Read-only audit of the Whop subscribe/cancel/trial/payment-failure flow on the live
senix.dev / Cloudflare deployment. Nothing was fixed. Method: static read of the code,
live probes of senix.dev, and read-only queries against the production Supabase project
(confirmed prod: the senix.dev client bundle inlines the same project ref,
stmeuylbgozhgqupsewg, as local .env).

1. WEBHOOK URL — UNKNOWN (needs Whop dashboard access). Could not read the Whop
   dashboard webhook config, so cannot confirm the registered delivery URL is
   https://senix.dev/api/webhooks/whop and not a stale vercel.app URL. What is
   confirmed: that endpoint is live on Cloudflare (GET returns {"status":"ready"},
   HTTP 200) and behaves correctly, so IF Whop points there it will work. Open: user
   to confirm the URL in the Whop Webhooks tab.

2. WEBHOOK SIGNATURE VERIFICATION — PARTIAL PASS. A live POST with a bogus signature
   returns 401 "Invalid signature", proving whopsdk.webhooks.unwrap is called on the
   live deployment and is not bypassed, and that WHOP_WEBHOOK_SECRET is set to some
   value in the Worker (btoa('') would still 401). NOT proven: that the secret value
   matches Whop's actual signing secret. Only a real signed delivery (sandbox test or
   prod logs showing an accepted event) can confirm correctness. Note: whop-sdk.ts
   base64-encodes the raw secret via btoa(); local WHOP_WEBHOOK_SECRET is a raw ws_...
   value, consistent with that assumption. Could not list Cloudflare secrets directly
   (wrangler not authenticated on this box).

3. EVENT COVERAGE — UNKNOWN (needs Whop dashboard access). Code handles exactly four
   events: membership.activated, membership.deactivated, payment.succeeded,
   payment.failed (src/app/api/webhooks/whop/route.ts). Cannot confirm the dashboard
   has these four enabled and nothing else. Open: user to compare against the Whop
   dashboard event selection.

4. IDEMPOTENCY — FAIL. The dedup table processed_webhook_events does NOT exist in the
   production Supabase project (PostgREST PGRST205, same as a control fake table; a
   webhook_events table exists but that is the separate GitHub-delivery table).
   Migration 010 (marked "Run manually in Supabase") was never applied. Effect:
   alreadyProcessed() always returns false and markProcessed() inserts fail silently
   (error is only logged), so Whop retries/duplicate deliveries are reprocessed. Mostly
   self-correcting for plan updates, but produces duplicate plan_events rows and can
   double-fire the past_due -> reactivated path. Fix later: apply migration 010 to prod.

5. END-TO-END SANDBOX TEST — NOT RUN (blocked). No Whop sandbox credentials/dashboard
   access from here, and running a real checkout requires an authenticated browser
   session. To enable: (a) confirm a Whop sandbox/test company + test plan IDs exist,
   (b) provide sandbox WHOP_API_KEY / plan IDs / app id, (c) access to the Whop
   dashboard to trigger and observe the delivery, and (d) apply migration 010 first
   (see check 4) so the run also exercises idempotency.

6. ENV VAR AUDIT — PARTIAL / UNKNOWN for prod. Whop/billing vars the code reads:
   NEXT_PUBLIC_WHOP_APP_ID (whop-sdk.ts, embedded checkout), WHOP_API_KEY (whop-sdk.ts,
   cancel, checkout link, company lookup), WHOP_WEBHOOK_SECRET (whop-sdk.ts),
   WHOP_COMPANY_ID (reconcile-subscriptions throws if missing; cancel/company lookup),
   WHOP_{STARTER,TEAM,PRO}_{MONTHLY,YEARLY}_ID (plan resolution / checkout),
   WHOP_{STARTER,TEAM,PRO}_PRODUCT_ID (legacy fallback in /api/billing/checkout).
   Cannot list Cloudflare Worker secrets (wrangler not authenticated), so production
   presence is UNKNOWN. Flags from local files (indicative only, not prod): local .env
   has real-looking WHOP_API_KEY (apik_...), WHOP_WEBHOOK_SECRET (ws_...), and all six
   plan_... IDs, but is MISSING WHOP_COMPANY_ID, NEXT_PUBLIC_WHOP_APP_ID, and the three
   WHOP_*_PRODUCT_ID vars. If Cloudflare mirrors this, reconcile-subscriptions would
   throw (WHOP_COMPANY_ID) and the SDK client / embedded checkout would lack the app
   id. Also noticed a typo in .env.local: CRON_SECRETE (should be CRON_SECRET); local
   only, but worth checking the Cloudflare secret and GitHub repo secret are spelled
   CRON_SECRET. Open: user to confirm each var is set (correctly, non-placeholder) in
   Cloudflare Worker secrets, especially WHOP_COMPANY_ID and NEXT_PUBLIC_WHOP_APP_ID.

Overall: one confirmed break (idempotency table missing in prod, #4). Signature
verification is live and not bypassed (#2). Webhook URL, event coverage, sandbox test,
and prod env-var presence remain UNKNOWN pending Whop dashboard access and Cloudflare
secret visibility. No fixes applied per instruction.

## Phase 1 — Final Summary (2026-07-16, evening)

Closed out with dashboard access and a real signed test delivery. Final state:

1. WEBHOOK URL — PASS. User created a fresh Whop webhook pointing at
   https://senix.dev/api/webhooks/whop (company biz_FS5omakuJ54QJe). OPEN: the
   dashboard shows a second, older webhook row; confirm it is disabled or deleted so
   events are not double-delivered to a stale URL.
2. WEBHOOK SECRET — PASS after one bug. The first rotation stored the webhook's object
   id (hook_ prefix) instead of its signing secret, so real deliveries returned 401.
   Per current Whop docs (docs.whop.com/developer/guides/webhooks) the
   btoa(WHOP_WEBHOOK_SECRET) call in src/lib/whop-sdk.ts is exactly what the docs
   prescribe (the Standard Webhooks verifier expects a base64 key), so no code change
   was needed. After storing the real secret, Whop's "Test webhook" panel returned
   200 OK. Lesson: hook_ values are webhook ids, not secrets.
3. EVENT TYPE NOTATION — CONFIRMED dot-notation on the wire. The dashboard UI lists
   events with underscores (membership_activated) but the delivered payload's type is
   "membership.activated" (verified from the recorded event row, see 4), matching the
   handler's switch. No code change needed.
4. IDEMPOTENCY — PASS. Migration 010 is applied in prod; the test delivery wrote a row
   to processed_webhook_events (event_id msg_msteO64c7F9lt6K2HB2bvU69, event_type
   membership.activated, processed_at 2026-07-16T18:17:14Z). This proves unwrap,
   alreadyProcessed, the handler path, and markProcessed all ran without error and
   Whop received 200.
5. END-TO-END SANDBOX TEST — PARTIAL. A signed membership.activated test delivery was
   processed successfully end to end, but a full paid checkout, activate, cancel,
   deactivate loop with a real user row update has not yet been run.
6. ENV VARS — FAIL on one var: WHOP_COMPANY_ID is missing from Cloudflare Worker
   secrets. The daily cron-reconcile GitHub Action has failed every day with
   {"error":"WHOP_COMPANY_ID is not configured."} (HTTP 500), so the reconciliation
   safety net has never run. Fix: add WHOP_COMPANY_ID (biz_FS5omakuJ54QJe) to Worker
   secrets, then re-run the workflow. CRON_SECRET itself is fine end to end (correctly
   named in GitHub repo secrets, endpoint auth passes); the CRON_SECRETE typo is
   local-only. GitHub repo secrets present: CLOUDFLARE_ACCOUNT_ID,
   CLOUDFLARE_API_TOKEN, CRON_SECRET, INTERNAL_PASSWORD, NEXT_PUBLIC_APP_URL,
   NEXT_PUBLIC_GITHUB_APP_SLUG, NEXT_PUBLIC_SUPABASE_ANON_KEY,
   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_WHOP_APP_ID.

Still open: add WHOP_COMPANY_ID to Cloudflare (item 6), disable or delete the old
stale webhook if still enabled (item 1), run one full paid checkout and cancel loop
(item 5), and rotate the webhook secret at some point since a candidate value was
pasted into chat during debugging.

## Phase 1 — Closeout (2026-07-16, night)

Cleanup items resolved; Phase 1 is closed and Phase 2 (Whop credit pack product
setup) is clear to start.

1. WHOP_COMPANY_ID / cron-reconcile: FIXED and CONFIRMED GREEN. Root cause of the
   persistent "WHOP_COMPANY_ID is not configured" 500 was a trailing space in the
   secret NAME as saved through the Cloudflare dashboard ("WHOP_COMPANY_ID "), which
   is a different variable at runtime. User deleted it and re-added via
   "wrangler secret put" (bypassing the dashboard), verified with
   "wrangler secret list --name senix". Manually dispatched cron-reconcile run
   29528574362 (2026-07-16T19:34:58Z) completed SUCCESS with sane bodies:
   reconcile {"ok":true,"activeMembershipsSeen":0,"activated":0,"downgraded":0,
   "unmatched":0} (zero memberships is expected, no paying users yet) and hotfix scan
   {"ok":true,...}. The daily schedule should now stay green; if it fails again the
   cause is something new. Lesson: Cloudflare dashboard secret names can silently
   keep whitespace; prefer wrangler secret put, verify with wrangler secret list.
2. Old second Whop webhook row: STILL UNRESOLVED. User's messages repeatedly
   contained unfilled placeholders instead of the actual URL/state, so its URL and
   enabled state were never recorded. Risk if still enabled: duplicate deliveries to
   a stale (likely vercel.app) URL. Next session: ask for the URL and whether it was
   disabled, then record it here.
3. Webhook secret rotation: still recommended at leisure (a candidate secret value
   transited chat during debugging on 2026-07-16).
4. Full paid checkout -> activate -> cancel -> deactivate loop with a real user row:
   still not run; fold into Phase 2 testing with a real purchase.

## Phase 2 — Credit pack product setup, part 1 (2026-07-16)

Added four Cloudflare Worker secrets for the new one-time credit top-up products via
"wrangler secret put --name senix" (wrangler is now OAuth-authenticated on this box
as mainsenix@gmail.com, account ff194ed894eab8b76db8f1be13d53221):

1. WHOP_CREDITS_SMALL_ID = plan_GY1a5Y17QARfu (Small, $10)
2. WHOP_CREDITS_SMALL_PRODUCT_ID = prod_O4eHRVvIJSPS1
3. WHOP_CREDITS_LARGE_ID = plan_HeOH4F8D2yFVD (Large, $25)
4. WHOP_CREDITS_LARGE_PRODUCT_ID = prod_O4eHRVvIJSPS1

Verified with "wrangler secret list --name senix" printing each name through Python
repr(): all four names are exact, no whitespace (WHOP_COMPANY_ID also confirmed
clean). No application code touched yet; nothing reads these vars until part 2.

FLAG RESOLVED (2026-07-16, later): Small and Large are genuinely separate Whop
products; the duplicated product_id was a paste error on Small. Updated via wrangler:
WHOP_CREDITS_SMALL_PRODUCT_ID = prod_w6xHvz1ZsuNq4. Large stays prod_O4eHRVvIJSPS1
(FULLY CONFIRMED 2026-07-17: user checked the Whop Products page directly; it is
genuinely Large's own product). Names re-verified clean via wrangler secret list.

## Phase 2 — Credit pack checkout + webhook code, part 2 (2026-07-16)

Wrote the credit purchase code, uncommitted, awaiting user review of the diffs. No
database changes made. Changes:

1. features/billing/whop.ts: CreditPackName type, CREDIT_PACK_DETAILS (label, price,
   credits per pack), creditPackPlanId(), creditPackForWhopIds() reverse lookup.
2. src/app/api/checkout/route.ts: POST body { kind: 'credits', pack: 'small'|'large' }
   branch; resolves the pack's Whop plan id and stamps metadata
   { user_id, kind: 'credits', pack } on the checkout configuration. Plan checkout
   path unchanged.
3. src/app/api/webhooks/whop/route.ts: handlePaymentSucceeded now routes credit pack
   payments (matched by checkout metadata first, plan/product id fallback) to
   grantCreditPack(), which inserts a credit_packs row and deliberately skips all
   subscription logic so a top-up never touches plan/plan_status. Unique-violation
   on insert is treated as an already-granted no-op.

tsc --noEmit clean; all 30 existing billing tests pass.

OPEN before this ships (statuses updated in part 3, see below):
1. Credit amounts: RESOLVED 2026-07-17, small = 200,000 tokens ($10), large =
   600,000 tokens ($25), confirmed by user and set in CREDIT_PACK_DETAILS.
2. credit_packs table: migration written in part 3, not yet applied.
3. Tests: added in part 3.
4. Nothing committed or deployed.

## Phase 2 — Credit pack migration + consume_tokens + tests, part 3 (2026-07-17)

1. supabase/migrations/016_credit_packs.sql (NOT YET APPLIED, awaiting user review
   and manual run in the SQL Editor; note there is no migration 015, numbered per
   user instruction): credit_packs table (UNIQUE whop_payment_id for payment-level
   idempotency, CHECK credits_used <= credits, 12-month expiry DEFAULT which is a
   PLACEHOLDER pending confirmation), RLS enabled with owner SELECT policy only
   (writes are service-role only, same pattern as billing columns), and the
   consume_tokens(user_id, tokens, monthly_limit) RPC: locks the user row FOR
   UPDATE (serializes concurrent spends), drains the monthly budget first, then
   non-expired packs oldest-expiring first; denies without consuming anything when
   the combined balance is insufficient.
2. scripts/sql/test-consume-tokens.sql: self-contained BEGIN/ROLLBACK verification
   script for the RPC (7 cases: monthly-only, overflow order, span packs,
   insufficient, expired ignored, unknown user, duplicate payment id). Safe to run
   in prod; rolls back everything.
3. Tests: features/billing/__tests__/credit-packs.test.ts (webhook: metadata-first
   routing, id fallback, duplicate no-op, subscription payments never hit the
   credit path) and credit-pack-mapping.test.ts (env mapping + amounts).
   All 38 billing tests pass; tsc clean.
4. Routing confirmed for user sign-off: credit branch is metadata-first
   (payment.metadata.kind === 'credits'), plan/product id mapping is fallback
   only; subscription payments cannot reach grantCreditPack unless a WHOP_CREDITS_*
   env value were misconfigured to equal a subscription plan id.

Migration 016 APPLIED to prod by user (2026-07-17, SQL Editor, no errors): table,
index, policy, and consume_tokens all created.

Numbering DECISION (2026-07-17, explicit, closed): keep 016 with no 015 file.
Migrations are run manually in the SQL Editor so nothing tracks filenames; the gap
is documented in the file header. Do not rename; continue at 017.

RPC VERIFIED in prod (2026-07-17): user ran scripts/sql/test-consume-tokens.sql in
the SQL Editor; "Success. No rows returned." and all 7 PASS notices visible in the
Messages panel, no FAIL; rollback confirmed (credit_packs empty in Table Editor).
Part 3 (migration + RPC) is CLOSED.

## Phase 2 — consume_tokens wired into the gate, part 4 (2026-07-17)

features/billing/plan-limits.ts: checkTokenLimit now calls the consume_tokens RPC
(was increment_token_usage), passing user_id, the estimate, and the effective
plan's monthly limit. New exported TokenLimitResult type: allowed:true carries
{ fromMonthly, fromPacks } threaded from the RPC's response; the denial message
now says budget AND credit balance exhausted. recordTokenUsage is unchanged in
behavior (adjust_token_usage on the monthly counter only); its doc comment now
documents the accepted tradeoff: true-up never claws back or tops up packs, total
charged still equals actual, only the split between pools can drift by up to
(estimate - actual) per review. Call sites (PR webhook, MCP, playground) needed no
changes. Tests updated/added in plan-limits.test.ts (consume_tokens call shape,
pack-overflow split threading, combined-exhaustion denial). tsc clean; 47 tests
pass across billing + integration.

increment_token_usage: repo-wide search shows NO remaining application callers
(only migration 012's SQL, comments, and history). Left in place in the database
and in migration 012 per user instruction; removal needs explicit user approval.

Pack expiry RESOLVED (2026-07-17): 12 months is intentional, mirroring Anthropic's
own API credit expiry policy; migration 016's comment updated to say so. Phase 2b
(buy buttons + balance display UI) split into its own follow-up per decision.

Phase 2 backend committed on branch feature/credit-packs, PR #17. Senix's dogfood
review never completed (see incident below); the PR was manually reviewed in full by
the user across the session and MERGED to main on that basis (2026-07-17).

## Incident — analyses stranded by the Workers waitUntil 30s limit (2026-07-17)

Found while waiting for Senix to review PR #17. ROOT CAUSE CONFIRMED: PR analyses
run in after(), which OpenNext backs with ctx.waitUntil(); Cloudflare cancels
waitUntil work ~30 seconds after the response is sent (documented, all plans:
developers.cloudflare.com/workers/platform/limits). The cancellation does not
throw, so no catch runs, the Redis fallback in dispatchAnalyzePr never fires, and
the analyses row sits in status running forever with no error. The code comments
claiming "no wall-clock cap on Workers, billing is CPU time" confused CPU limits
with the waitUntil lifetime; they are wrong.

Evidence: the only two analyses that ever completed on Cloudflare took 7.3s and
23.0s; 5 of the 6 most recent (PR #17, two attempts on PR #16, three on 07-07)
are stranded in running. Cloudflare Observability shows "waitUntil() tasks did
not complete within the allowed time ... cancelled" after POST
/api/webhooks/github. The GitHub PR path also has NO diff-size cap (playground
caps 50KB, MCP caps input; PR path only skips structural diff above 50 files),
and the LLM failover ladder allows worst cases of minutes against the 30s budget.

Mitigation shipped: PR #18 (fix/stranded-analysis-watchdog) adds internal
endpoint check-stranded-analyses (marks rows non-terminal for >2 min as failed
with an explanatory message, logs at error level) plus a step in the daily
maintenance workflow that fails loudly when any are found.

REAL FIX PENDING: move analysis execution off waitUntil onto Cloudflare Queues.
CONFIRMED AVAILABLE on this account's current Workers Free plan (wrangler queues
list works; free tier includes 10,000 ops/day, ~3 ops per message; consumers get
15 min wall time). No plan upgrade needed.

DIRECTION REVISED (2026-07-17): Cloudflare Workflows, not Queues, per Cloudflare's
own guidance (Queues for single-step jobs, Workflows for multi-step processes with
per-step retry; per-step wall clock is unlimited for network waits). Workflows is
also confirmed accessible on this account (wrangler workflows list works).

## Fix — analyze-pr moved to Cloudflare Workflows (2026-07-17)

Implemented on branch fix/analyze-pr-workflows. Design as agreed:

1. features/review-queue/workflow/steps.ts: the pipeline decomposed into shared,
   individually retryable step functions (preflightAnalysis, buildDiffSummary,
   runLlmAnalysis, postAnalysisComment, finalizeAnalysis, trueUpTokenUsage). Step
   inputs/outputs are JSON-serializable and compact (raw file contents never cross
   a step boundary; only the structural diff summary does). postAnalysisComment
   now persists the comment id inside the step right after creation, closing the
   retry window that could have double-commented.
2. features/review-queue/workflow/analyze-pr-workflow.ts: AnalyzePrWorkflow
   (WorkflowEntrypoint) runs each stage in step.do() with retry configs (LLM step
   retries capped low because analyzePR already runs the provider failover ladder
   internally). On step-retry exhaustion it marks the analysis failed (guarded,
   non-terminal states only), releases the Redis claim, and rethrows. It hydrates
   process.env from this.env because OpenNext does not populate process.env for
   Workflow invocations.
3. worker.ts (repo root): custom Worker entry re-exporting the OpenNext-generated
   handler plus AnalyzePrWorkflow; wrangler.jsonc main now points here and adds
   the workflows binding (name senix-analyze-pr, binding ANALYZE_PR_WORKFLOW).
4. Dispatch (features/webhook/handlers/pull-request.ts): tries the Workflow
   binding first (instance id = analysisId, a bonus dedup layer); anywhere the
   binding is absent (node dev, tests, standalone worker) or create() fails, it
   falls back to the legacy after() path, then Redis, exactly as before.
   processAnalyzePr remains as the sequential runner for those paths.
5. types/cloudflare-workers.d.ts: minimal local shim for the cloudflare:workers
   virtual module (the repo does not use @cloudflare/workers-types).
6. Tests: analyze-pr-workflow.test.ts (step order, preflight short-circuit,
   comment skip on LLM failure, failure marking + claim release + rethrow). tsc
   clean; all 145 tests pass, including unchanged integration suites which
   exercise the preserved after() fallback.

CAVEAT: the OpenNext build cannot be verified on this Windows box (known); the
custom worker.ts entry + workflows binding get their first real verification in
the GitHub Actions deploy. If the deploy fails, look there first.

## Workflows migration VERIFIED end to end in production (2026-07-17)

After two merge mishaps (PR #19 merged at a stale head missing the init fix, then
landed via PR #20; deploy run 41 success), test PR #21 validated the new path live:

1. Webhook response: "pull_request:reopened:Senix-Org/senix#21:workflow-dispatched"
   (read from the GitHub App delivery log via the app API).
2. wrangler workflows instances list senix-analyze-pr: one instance, id
   2ca554cd-8ec0-4280-994a-74da3ecb3b1d, exactly the analysis row id, Completed.
3. Analysis row completed in 21s with tokens_used 2308 and a posted PR comment.
   Architecture line above ("dispatched via after()") is now outdated: production
   dispatch is the ANALYZE_PR_WORKFLOW binding; after() and Redis remain fallbacks.

Also found and fixed during validation: the first PR #21 open was denied
"limit-reached" because 13 stranded analyses this month each held a 2,000-token
reservation that was never trued up (the waitUntil kills happened before refund),
putting installer user senix-dev at 48,046/50,000. Refunded exactly 26,000 via
adjust_token_usage (now 22,046). Note for the future: stranded/failed analyses leak
their reservation; the Workflow's failure path does not refund either (only marks
failed). Consider a refund in mark-analysis-failed or a watchdog-side refund.

## PostHog client-side analytics, Phase 2 (2026-07-17, PR #22)

posthog-js added via src/instrumentation-client.ts (autocapture + pageviews;
capture_pageview 'history_change' covers App Router client-side navigations).
Client-side only; no server/webhook/billing code touched. Key finding, third
instance of the build-vs-runtime trap this week: NEXT_PUBLIC_* values CANNOT be
Cloudflare Worker secrets — they are inlined during the GitHub Actions build,
which cannot see runtime Worker secrets. They live as GitHub Actions repository
VARIABLES (vars.NEXT_PUBLIC_POSTHOG_KEY / _HOST, created by user; Variables not
Secrets because the key is public-by-design in the bundle, and rotation needs no
code change). Host confirmed https://us.i.posthog.com. Verification after
deploy: PostHog Activity view shows $pageview on load, $pageview per client-side
navigation, $autocapture on clicks. Since Senix's own review will analyze PR #22
via the new Workflows path, that also re-exercises the pipeline.

## Backlog — next up (2026-07-18, do first)

1. TOKEN RESERVATION LEAK — own PR, planned 2026-07-17 night, execute fresh:
   refund token reservations on all non-success analysis terminations (the
   Workflow mark-analysis-failed step, processAnalyzePr catch/fallback paths,
   the watchdog sweep-to-failed, and the preflight skip paths for uninstalled /
   over-repo-limit — EXCLUDING the already-claimed skip, where the winning
   claimant does the true-up). Refund = recordTokenUsage(userId, 0, source,
   ESTIMATED_TOKENS_PER_REVIEW), i.e. the existing adjust_token_usage pattern;
   no new RPC. Key each refund to WINNING the status transition (guarded update
   .in('status', ['queued','running']) plus .select() to detect the win) so it
   fires at most once per analysis even when the Workflow failure path and the
   watchdog race. The watchdog endpoint needs the userId join
   (pull_requests -> repositories -> installations.installed_by_user_id).
   Roughly 100-150 lines including idempotency tests. Context: 13 stranded
   analyses leaked 26,000 tokens this month (manually refunded 2026-07-17).

2. DASHBOARD DISPLAY BUGS (reported 2026-07-17, NOT yet investigated, record
   only). Two separate reviews-list symptoms to look into fresh:
   a. DUPLICATE ROWS: PR #22 shows twice in the reviews list with two
      different analysis ids and two different risk badges. Hypothesis:
      duplicate webhook delivery created two analyses rows instead of
      deduping. Check the GitHub delivery idempotency (claimDelivery /
      github_delivery_id unique) and whether reopen/synchronize legitimately
      creates a second analysis vs an accidental duplicate; confirm against
      the analyses rows for PR #22's pull_request_id.
   b. "UNKNOWN" RISK BADGE: PR #23 and #24 show "Unknown" instead of a risk
      badge in the reviews list even though the analysis completed. Hypothesis:
      the pipeline completed without producing/attaching a risk_level (LLM
      returned no riskLevel, or finalizeAnalysis wrote null). Check those
      analyses rows' risk_level and whether the LLM step failed silently while
      the structural diff still marked the row completed (llmError path).
   Both are display/data-integrity issues, not blockers; investigate with a
   clear head, do not fix tonight.

## Backlog — scalability

1. PR-path diff-size cap: the GitHub PR analysis path still has NO input-size
   cap (playground caps 50KB, MCP caps input; PR path only skips the structural
   diff above 50 files). Workflows removed the time pressure, but an enormous
   diff still means unbounded GitHub fetches and LLM prompt cost. Decide and
   implement a cap as a cost-control measure. Explicitly logged as backlog
   (2026-07-17), not dropped.

# Project conventions for Claude Code

Writing style:
Do not use em-dashes or en-dashes in any generated text. Use commas, periods, 
or parentheses instead. Write complete sentences with normal punctuation. 
Use plain numbered lists, not bullets with dashes.