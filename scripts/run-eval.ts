import 'dotenv/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { analyzePR } from '../src/lib/llm';
import type { EvalCase, EvalResult, EvalRun } from './lib/eval-types';
import { MAX_SCORE_PER_CASE } from './lib/eval-types';

const CASES_DIR = path.resolve(process.cwd(), 'eval/cases');
const RUNS_DIR = path.resolve(process.cwd(), 'eval/runs');

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * Eval runner: executes the active LLM provider against every case in
 * `eval/cases/`, prints a live results table, and saves the unscored
 * EvalRun JSON to `eval/runs/{promptVersion}-{timestamp}.json`.
 *
 * Usage: `npx tsx scripts/run-eval.ts <promptVersion>`
 */
async function main(): Promise<void> {
  const promptVersion = process.argv[2];
  if (!promptVersion) {
    console.error('usage: tsx scripts/run-eval.ts <promptVersion>');
    process.exit(1);
  }

  const cases = await loadCases();
  if (cases.length === 0) {
    console.error(`No cases found in ${CASES_DIR}`);
    process.exit(1);
  }

  const provider = process.env.LLM_PROVIDER ?? 'groq';
  console.log(
    `${ANSI.bold}Running ${cases.length} cases${ANSI.reset} ${ANSI.dim}(promptVersion=${promptVersion}, provider=${provider})${ANSI.reset}\n`
  );

  printHeader();

  const results: EvalResult[] = [];
  let modelSeen = 'unknown';

  for (let i = 0; i < cases.length; i++) {
    const evalCase = cases[i];
    const startedAt = Date.now();
    let result: EvalResult;
    try {
      const output = await analyzePR({
        prMeta: evalCase.prMeta,
        structuralDiff: evalCase.structuralDiff,
      });
      modelSeen = output.provider;
      result = {
        case: evalCase,
        output,
        score: null,
        durationMs: Date.now() - startedAt,
        error: null,
      };
    } catch (err) {
      result = {
        case: evalCase,
        output: null,
        score: null,
        durationMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      };
    }
    results.push(result);
    printRow(i + 1, result);
  }

  const run: EvalRun = {
    promptVersion,
    provider,
    model: modelSeen,
    startedAt: new Date().toISOString(),
    totalCases: cases.length,
    results,
    totalScore: null,
    maxScore: MAX_SCORE_PER_CASE * cases.length,
  };

  const outPath = await saveRun(run);
  printSummary(run, outPath);
}

async function loadCases(): Promise<EvalCase[]> {
  const entries = await fs.readdir(CASES_DIR);
  const jsonFiles = entries.filter((f) => f.endsWith('.json')).sort();
  const cases: EvalCase[] = [];
  for (const file of jsonFiles) {
    const raw = await fs.readFile(path.join(CASES_DIR, file), 'utf8');
    cases.push(JSON.parse(raw) as EvalCase);
  }
  return cases;
}

async function saveRun(run: EvalRun): Promise<string> {
  await fs.mkdir(RUNS_DIR, { recursive: true });
  const stamp = run.startedAt.replace(/:/g, '-').replace(/\.\d+Z$/, 'Z');
  const filename = `${run.promptVersion}-${stamp}.json`;
  const fullPath = path.join(RUNS_DIR, filename);
  await fs.writeFile(fullPath, JSON.stringify(run, null, 2));
  return fullPath;
}

function printHeader(): void {
  const cols = `${pad('#', 3)} ${pad('case-id', 32)} ${pad('risk (got/expected)', 22)} ${pad('flags', 24)} ${pad('duration', 10)} notes`;
  console.log(`${ANSI.bold}${cols}${ANSI.reset}`);
  console.log(ANSI.gray + '-'.repeat(110) + ANSI.reset);
}

function printRow(num: number, result: EvalResult): void {
  const c = result.case;
  const out = result.output;

  if (result.error || !out) {
    console.log(
      `${pad(String(num), 3)} ${pad(c.id, 32)} ${ANSI.red}${pad('ERROR', 22)}${ANSI.reset} ${pad('-', 24)} ${pad(`${result.durationMs}ms`, 10)} ${ANSI.red}${result.error ?? 'no output'}${ANSI.reset}`
    );
    return;
  }

  const riskMatch = out.riskLevel === c.expectedRiskLevel;
  const riskCell = `${out.riskLevel}/${c.expectedRiskLevel}`;
  const riskColored = riskMatch
    ? `${ANSI.green}${pad(riskCell, 22)}${ANSI.reset}`
    : `${ANSI.red}${pad(riskCell, 22)}${ANSI.reset}`;

  const flagOverlap = computeFlagOverlap(out.riskFlags, c.expectedFlags);
  const flagCell = `${flagOverlap.matched}/${c.expectedFlags.length} ${flagOverlap.allMatched ? '✓' : '✗'}`;
  const flagColored = flagOverlap.allMatched
    ? `${ANSI.green}${pad(flagCell, 24)}${ANSI.reset}`
    : `${ANSI.yellow}${pad(flagCell, 24)}${ANSI.reset}`;

  const notes = out.riskFlags.length > 0 ? `flags=${out.riskFlags.join(',')}` : '(no flags)';

  console.log(
    `${pad(String(num), 3)} ${pad(c.id, 32)} ${riskColored} ${flagColored} ${pad(`${result.durationMs}ms`, 10)} ${ANSI.dim}${notes}${ANSI.reset}`
  );
}

function computeFlagOverlap(
  got: string[],
  expected: string[]
): { matched: number; allMatched: boolean } {
  if (expected.length === 0) {
    return { matched: 0, allMatched: got.length === 0 };
  }
  const gotSet = new Set(got);
  const matched = expected.filter((f) => gotSet.has(f)).length;
  return { matched, allMatched: matched === expected.length };
}

function printSummary(run: EvalRun, outPath: string): void {
  const errors = run.results.filter((r) => r.error).length;
  const completed = run.results.length - errors;
  const avgDuration =
    completed === 0
      ? 0
      : Math.round(
          run.results.filter((r) => !r.error).reduce((s, r) => s + r.durationMs, 0) / completed
        );
  const totalCostCents = run.results.reduce((s, r) => s + (r.output?.costUsdCents ?? 0), 0);

  console.log('');
  console.log(`${ANSI.bold}Summary${ANSI.reset}`);
  console.log(`  cases:    ${run.totalCases}`);
  console.log(`  errors:   ${errors > 0 ? ANSI.red : ANSI.green}${errors}${ANSI.reset}`);
  console.log(`  avg time: ${avgDuration}ms`);
  console.log(`  total $:  $${(totalCostCents / 100).toFixed(2)} (${totalCostCents}¢)`);
  console.log(`  saved:    ${ANSI.cyan}${outPath}${ANSI.reset}`);
  console.log(`\nNext: ${ANSI.bold}npx tsx scripts/score-eval.ts ${outPath}${ANSI.reset}`);
}

function pad(s: string, width: number): string {
  if (s.length >= width) return s.slice(0, width);
  return s + ' '.repeat(width - s.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
