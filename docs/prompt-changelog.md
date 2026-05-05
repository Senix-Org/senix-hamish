# Prompt Changelog

Track every change to the system or user prompt in `src/lib/prompts/pr-analysis.ts` here. Every entry should reference the eval run that justified shipping it.

Format:

```
## v2 — YYYY-MM-DD — short description
- Changed: what
- Reason: why
- Eval result: v1 X% → v2 Y%
```

Most recent first.

---

## v2 — 2026-05-05 — Fixed flag vocabulary, anti-flag rules, stricter calibration

- Changed:
  - Locked the risk-flag vocabulary to exactly 8 names (`sql-injection`, `auth-change`, `removed-validation`, `hardcoded-secret`, `new-external-api`, `dependency-added`, `payment-logic-change`, `data-leak`) with explicit definitions. Removed the "you may invent new kebab-case labels" escape hatch.
  - Added an explicit "DO NOT FLAG" section covering additive validation, new error handling, new tests, pure renames/extractions, and doc/whitespace edits.
  - Rewrote the risk-level guidance with concrete tier examples (HIGH includes payment/pricing logic and exposed PII; MEDIUM includes new external APIs, new dependencies, and added — not removed — auth flows; LOW includes additive validation and mechanical renames).
  - Replaced the soft "exactly 3 sentences" line with a stricter "Not 4. Not 2. Three." plus an instruction to never restate the file/function name.
- Reason: v1 eval (103/120, 86%) showed four failure modes:
  1. Tag taxonomy drift — the model invented flags like `payment-logic` and `input-validation-change`.
  2. Over-flagging additive safety — adding zod validation got flagged as a risk.
  3. Under-calibrating financial logic — a discount-cap change came back as `medium` instead of `high`.
  4. Conciseness drift — summaries running 4-5 sentences. The lowest-scoring cases (006, 007, 008) all hit at least one of these. v2 targets each directly: fixed vocabulary kills (1), DO-NOT-FLAG kills (2), explicit `payment-logic-change ⇒ HIGH` mapping kills (3), strict three-sentence wording targets (4).
- Eval result: v1 86% → v2 TBD (re-run pending).

## v1 — 2026-05-05 — Initial baseline

- Changed: established the v1 prompt as the baseline. Three-sentence summary requirement, kebab-case risk flags, max-3 focus areas, mandatory tool/JSON output.
- Reason: starting point for measured iteration.
- Eval result: baseline (103/120, 86%). Per-dimension: Accuracy 22/30 (73%), Specificity 30/30 (100%), Risk Calibration 27/30 (90%), Conciseness 24/30 (80%).


## v2 — 2026-05-05 — Tighten taxonomy, fix risk calibration, harder conciseness rule

**Changed:**
- Locked the risk_flags vocabulary to a fixed list of 8 tags with definitions (sql-injection, auth-change, removed-validation, hardcoded-secret, new-external-api, dependency-added, payment-logic-change, data-leak)
- Added explicit "DO NOT FLAG" section for additive safety changes (new validation, new error handling, new tests, refactors, comments)
- Added explicit risk-tier guidance with examples for low/medium/high
- Tightened summary instruction to "EXACTLY 3 sentences. Not 4. Not 2. Three."
- Added blast-radius framing: "If this merged today and broke tomorrow, what's the blast radius?"

**Reason:**
- v1 eval showed 4 failure modes: tag taxonomy drift, over-flagging additive safety, under-calibrating financial logic, conciseness drift
- Lowest-scoring v1 cases: 006 (hardcoded-secret), 007 (payment-logic), 008 (input-validation-added) all at 9/12

**Eval result:**
- v1 = 86% (103/120)
- v2 = 88% (105/120, including a network-timeout case as 0)
- Excluding the timeout: v2 = 94% (101/108) vs v1 = 84% (91/108) — +10 percentage points
- Improved on 8 cases, regressed on 0

## v1 — Initial baseline