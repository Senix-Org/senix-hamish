# Eval Rubric

Each case is scored on four dimensions, 1–3 each. Maximum per case: **12**. Maximum per run: **12 × number of cases**.

Scoring is done by a human, not an LLM. The runner produces output; you read it and type four numbers.

## Dimensions

### Accuracy — "Did it correctly describe what changed?"

- **3** — Output correctly describes the actual behavior change with no factual errors. The reviewer reading just the summary would understand what the PR does.
- **2** — Mostly correct with a minor inaccuracy. E.g. wrong line numbers, oversimplified, missed a small detail, or overstated something secondary.
- **1** — Substantially wrong. Describes a change that didn't happen, misses what actually did happen, or names the wrong files/symbols.

### Specificity — "Did it point to actual issues vs. generic advice?"

- **3** — Points to specific risks tied to specific code. E.g. "SQL injection in `findUserById` on line 47 — the `id` parameter is interpolated directly into the query string."
- **2** — Names risks but with generic phrasing. E.g. "potential security concerns around input handling" — true, but the reviewer still has to find the spot themselves.
- **1** — Vague or boilerplate. Could apply to any PR. E.g. "review carefully for edge cases" or "make sure tests pass."

### Risk Calibration — "Was the risk level appropriate?"

- **3** — Risk level matches the human's expected level exactly.
- **2** — Off by one tier in a defensible direction. E.g. a borderline payment-logic change rated "medium" instead of "high" — wrong but not crazy.
- **1** — Wildly off. E.g. flags a typo as "high", or rates a removed auth check as "low".

### Conciseness — "Stayed within 3 sentences, no filler?"

- **3** — Three sentences, no filler, every word earns its place. No throat-clearing ("This PR…"), no repetition.
- **2** — Slightly verbose but readable. Maybe one redundant clause or a 4th sentence.
- **1** — Padded, repetitive, or substantially longer than 4 sentences. Bullet points or headers when the spec said plain sentences.

## Tie-breakers

- If the LLM threw an error and produced no output: skip — leave score `null`. Comparison and totals exclude these.
- If the summary is technically correct but the risk level is wrong: score Accuracy on the summary alone, dock Risk Calibration separately.
- If you can't decide between two scores, pick the lower. Inflated scores hide regressions.

## Workflow

1. `npx tsx scripts/run-eval.ts v1` — generates `eval/runs/v1-<timestamp>.json`.
2. `npx tsx scripts/score-eval.ts eval/runs/v1-<timestamp>.json` — interactive scoring.
3. After changing the prompt, rerun and score `v2-...`.
4. `npx tsx scripts/compare-eval.ts eval/runs/v1-...json eval/runs/v2-...json` — see the delta.
5. Record the delta in `docs/prompt-changelog.md`.
