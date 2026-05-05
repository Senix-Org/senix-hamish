import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { EvalRun, EvalResult } from './lib/eval-types';
import { sumCaseScore } from './lib/eval-types';

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
 * Side-by-side comparison of two scored EvalRun JSON files. Highlights
 * regressions in red and improvements in green. Refuses to run if either
 * run still has any unscored cases.
 *
 * Usage: `npx tsx scripts/compare-eval.ts <run-a.json> <run-b.json>`
 */
async function main(): Promise<void> {
  const aPath = process.argv[2];
  const bPath = process.argv[3];
  if (!aPath || !bPath) {
    console.error('usage: tsx scripts/compare-eval.ts <run-a.json> <run-b.json>');
    process.exit(1);
  }

  const a = await loadRun(aPath);
  const b = await loadRun(bPath);

  assertFullyScored(a, aPath);
  assertFullyScored(b, bPath);

  const labelA = a.promptVersion;
  const labelB = b.promptVersion;

  console.log(
    `${ANSI.bold}Comparing ${labelA} vs ${labelB}${ANSI.reset} ${ANSI.dim}(${a.results.length} cases / ${b.results.length} cases)${ANSI.reset}\n`
  );

  const aById = new Map(a.results.map((r) => [r.case.id, r]));
  const bById = new Map(b.results.map((r) => [r.case.id, r]));
  const allIds = Array.from(new Set([...aById.keys(), ...bById.keys()])).sort();

  printHeader(labelA, labelB);

  let improved = 0;
  let regressed = 0;

  for (const id of allIds) {
    const ra = aById.get(id);
    const rb = bById.get(id);
    const sa = ra?.score ? sumCaseScore(ra.score) : null;
    const sb = rb?.score ? sumCaseScore(rb.score) : null;

    const delta = sa !== null && sb !== null ? sb - sa : null;
    if (delta !== null) {
      if (delta > 0) improved++;
      else if (delta < 0) regressed++;
    }

    const change = describeChange(ra, rb);
    printRow(id, sa, sb, delta, labelA, labelB, change);
  }

  printSummary(a, b, improved, regressed);
}

async function loadRun(p: string): Promise<EvalRun> {
  const absolute = path.resolve(p);
  const raw = await fs.readFile(absolute, 'utf8');
  return JSON.parse(raw) as EvalRun;
}

function assertFullyScored(run: EvalRun, label: string): void {
  const unscored = run.results.filter((r) => !r.error && r.score === null);
  if (unscored.length > 0) {
    throw new Error(
      `${label}: ${unscored.length} case(s) not yet scored. Run score-eval.ts first.`
    );
  }
}

function describeChange(a: EvalResult | undefined, b: EvalResult | undefined): string {
  if (!a) return 'new in B';
  if (!b) return 'missing in B';
  const aRisk = a.output?.riskLevel ?? '-';
  const bRisk = b.output?.riskLevel ?? '-';
  if (aRisk !== bRisk) return `risk ${aRisk} → ${bRisk}`;
  return '—';
}

function printHeader(labelA: string, labelB: string): void {
  const cols = `${pad('case-id', 32)} ${pad(labelA, 10)} ${pad(labelB, 10)} ${pad('delta', 8)} notable change`;
  console.log(`${ANSI.bold}${cols}${ANSI.reset}`);
  console.log(ANSI.gray + '-'.repeat(90) + ANSI.reset);
}

function printRow(
  id: string,
  sa: number | null,
  sb: number | null,
  delta: number | null,
  _labelA: string,
  _labelB: string,
  change: string
): void {
  const fmt = (n: number | null): string => (n === null ? '-' : String(n));
  let deltaCell = '—';
  if (delta !== null) {
    if (delta > 0) deltaCell = `${ANSI.green}+${delta}${ANSI.reset}`;
    else if (delta < 0) deltaCell = `${ANSI.red}${delta}${ANSI.reset}`;
    else deltaCell = `${ANSI.dim}0${ANSI.reset}`;
  }
  console.log(
    `${pad(id, 32)} ${pad(fmt(sa), 10)} ${pad(fmt(sb), 10)} ${padAnsi(deltaCell, 8)} ${ANSI.dim}${change}${ANSI.reset}`
  );
}

function printSummary(a: EvalRun, b: EvalRun, improved: number, regressed: number): void {
  const aPct = a.maxScore === 0 ? 0 : Math.round(((a.totalScore ?? 0) / a.maxScore) * 100);
  const bPct = b.maxScore === 0 ? 0 : Math.round(((b.totalScore ?? 0) / b.maxScore) * 100);
  const overall = bPct - aPct;
  const overallStr =
    overall > 0
      ? `${ANSI.green}+${overall}pp${ANSI.reset}`
      : overall < 0
      ? `${ANSI.red}${overall}pp${ANSI.reset}`
      : `${ANSI.dim}0pp${ANSI.reset}`;
  console.log('');
  console.log(
    `${ANSI.bold}${b.promptVersion} scored ${bPct}% (was ${aPct}% in ${a.promptVersion}, ${overallStr}). Improved on ${ANSI.green}${improved}${ANSI.reset} cases, regressed on ${ANSI.red}${regressed}${ANSI.reset} cases.${ANSI.reset}`
  );
}

function pad(s: string, width: number): string {
  if (s.length >= width) return s.slice(0, width);
  return s + ' '.repeat(width - s.length);
}

function padAnsi(s: string, width: number): string {
  // ANSI escapes don't add visible width; estimate visible length by stripping them
  const visible = s.replace(/\x1b\[[0-9;]*m/g, '');
  if (visible.length >= width) return s;
  return s + ' '.repeat(width - visible.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
