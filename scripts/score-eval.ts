import { promises as fs } from 'node:fs';
import path from 'node:path';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import type { EvalRun, EvalResult, EvalScore, ScoreValue } from './lib/eval-types';
import { SCORE_DIMENSIONS, sumCaseScore } from './lib/eval-types';

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

/**
 * Interactive scorer: walks through every case in a saved EvalRun,
 * prints the LLM output next to the human's expectations, and prompts
 * for four 1-3 dimension scores plus a one-line note. Writes the scored
 * run back to the same JSON file with `totalScore` filled in.
 *
 * Usage: `npx tsx scripts/score-eval.ts <path-to-run.json>`
 */
async function main(): Promise<void> {
  const runPath = process.argv[2];
  if (!runPath) {
    console.error('usage: tsx scripts/score-eval.ts <path-to-run.json>');
    process.exit(1);
  }
  const absolutePath = path.resolve(runPath);

  const raw = await fs.readFile(absolutePath, 'utf8');
  const run = JSON.parse(raw) as EvalRun;

  console.log(
    `${ANSI.bold}Scoring run${ANSI.reset} ${ANSI.dim}(promptVersion=${run.promptVersion}, provider=${run.provider}, cases=${run.totalCases})${ANSI.reset}\n`
  );

  const rl = readline.createInterface({ input, output });
  try {
    for (let i = 0; i < run.results.length; i++) {
      await scoreOne(rl, run.results[i], i + 1, run.results.length);
    }
  } finally {
    rl.close();
  }

  const scored = run.results.filter((r) => r.score !== null);
  const totalScore = scored.reduce((s, r) => s + (r.score ? sumCaseScore(r.score) : 0), 0);
  run.totalScore = totalScore;
  await fs.writeFile(absolutePath, JSON.stringify(run, null, 2));

  printFinalSummary(run);
}

async function scoreOne(
  rl: readline.Interface,
  result: EvalResult,
  index: number,
  total: number
): Promise<void> {
  const c = result.case;
  console.log(
    `${ANSI.bold}${ANSI.cyan}━━━ [${index}/${total}] ${c.id}${ANSI.reset} ${ANSI.dim}(${result.durationMs}ms)${ANSI.reset}`
  );
  console.log(`${ANSI.dim}${c.description}${ANSI.reset}\n`);

  if (result.error || !result.output) {
    console.log(`${ANSI.red}ERROR: ${result.error ?? 'no output'}${ANSI.reset}`);
    console.log(`${ANSI.dim}(skipping — no output to score)${ANSI.reset}\n`);
    return;
  }

  const out = result.output;
  const riskMatch = out.riskLevel === c.expectedRiskLevel;
  console.log(
    `${ANSI.bold}Risk:${ANSI.reset} got=${riskMatch ? ANSI.green : ANSI.red}${out.riskLevel}${ANSI.reset} expected=${c.expectedRiskLevel}`
  );
  const expectedFlags = c.expectedFlags.length > 0 ? c.expectedFlags.join(', ') : '(none)';
  const gotFlags = out.riskFlags.length > 0 ? out.riskFlags.join(', ') : '(none)';
  const overlapPct = computeOverlapPct(out.riskFlags, c.expectedFlags);
  console.log(
    `${ANSI.bold}Flags:${ANSI.reset} got=[${gotFlags}] expected=[${expectedFlags}] overlap=${overlapPct}%`
  );

  console.log(`\n${ANSI.bold}Summary:${ANSI.reset}`);
  console.log(`  ${out.summary}`);

  if (out.focusAreas.length > 0) {
    console.log(`\n${ANSI.bold}Focus areas:${ANSI.reset}`);
    for (const f of out.focusAreas) {
      console.log(`  ${ANSI.magenta}${f.file}${ANSI.reset} (lines ${f.lines}) — ${f.reason}`);
    }
  }

  console.log('');
  const accuracy = await askScore(rl, 'Accuracy        (1-3)');
  const specificity = await askScore(rl, 'Specificity     (1-3)');
  const riskCalibration = await askScore(rl, 'Risk calibration(1-3)');
  const conciseness = await askScore(rl, 'Conciseness     (1-3)');
  const notes = (await rl.question('Notes (optional): ')).trim();

  const score: EvalScore = {
    caseId: c.id,
    accuracy,
    specificity,
    riskCalibration,
    conciseness,
    notes,
  };
  result.score = score;

  const caseTotal = sumCaseScore(score);
  console.log(`${ANSI.dim}→ ${caseTotal}/12 (${SCORE_DIMENSIONS.map((d) => `${d}=${score[d]}`).join(', ')})${ANSI.reset}\n`);
}

async function askScore(rl: readline.Interface, label: string): Promise<ScoreValue> {
  while (true) {
    const answer = (await rl.question(`  ${label}: `)).trim();
    if (answer === '1' || answer === '2' || answer === '3') {
      return Number(answer) as ScoreValue;
    }
    console.log(`  ${ANSI.red}must be 1, 2, or 3${ANSI.reset}`);
  }
}

function computeOverlapPct(got: string[], expected: string[]): number {
  if (expected.length === 0) return got.length === 0 ? 100 : 0;
  const gotSet = new Set(got);
  const matched = expected.filter((f) => gotSet.has(f)).length;
  return Math.round((matched / expected.length) * 100);
}

function printFinalSummary(run: EvalRun): void {
  const total = run.totalScore ?? 0;
  const max = run.maxScore;
  const pct = max === 0 ? 0 : Math.round((total / max) * 100);
  console.log('');
  console.log(
    `${ANSI.bold}Run ${run.promptVersion} scored ${total}/${max} (${pct}%)${ANSI.reset}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
