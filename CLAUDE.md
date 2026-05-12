# Senix

Senix is a GitHub App that posts AI-generated risk/behavior summaries on pull requests.

## Stack

Next.js (App Router) on Vercel serverless · Supabase (Postgres + RLS + auth) · Upstash Redis (queue, kept as fallback) · DeepSeek (primary LLM, with Groq/Gemini/Anthropic providers) · tree-sitter (structural diff).

## Architecture

GitHub webhook → `/api/webhooks/github` → `handlePullRequest` upserts PR + analysis rows → fire-and-forget POST to `/api/internal/analyze-pr` (Vercel serverless, `maxDuration=60`) → fetches diff, builds structural diff, calls LLM, updates Supabase, posts/updates PR comment. The standalone Node worker (`worker/`) polls Redis and is an optional fallback only.

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
