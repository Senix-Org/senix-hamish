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
# Project conventions for Claude Code

Writing style:
Do not use em-dashes or en-dashes in any generated text. Use commas, periods, 
or parentheses instead. Write complete sentences with normal punctuation. 
Use plain numbered lists, not bullets with dashes.