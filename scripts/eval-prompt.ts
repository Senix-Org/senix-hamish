import 'dotenv/config';
import { supabaseAdmin } from '../src/lib/supabase';
import { analyzePR } from '../src/lib/llm';
import type { FileStructuralDiff } from '../src/lib/structural-diff';

type EvalAnalysisRow = {
  id: string;
  commit_sha: string | null;
  risk_flags: {
    file_count?: number;
    additions?: number;
    deletions?: number;
    structural_diff?: FileStructuralDiff[];
  } | null;
  pull_requests: {
    title: string | null;
    author_login: string | null;
    repositories: { full_name: string | null } | null;
  } | null;
};

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
};

function colorRisk(level: string): string {
  if (level === 'high') return `${ANSI.red}${level}${ANSI.reset}`;
  if (level === 'medium') return `${ANSI.yellow}${level}${ANSI.reset}`;
  return `${ANSI.green}${level}${ANSI.reset}`;
}

function colorProvider(provider: string): string {
  return `${ANSI.blue}[${provider}]${ANSI.reset}`;
}

/**
 * Replay the LLM analysis against the 5 most recent completed analyses
 * that have a non-empty structural diff. Each generated summary is printed
 * alongside the source PR with a provider tag, and the script totals the
 * Anthropic spend at the end (Gemini runs are free and excluded).
 */
async function main(): Promise<void> {
  const { data: rows, error } = await supabaseAdmin
    .from('analyses')
    .select(
      'id, commit_sha, risk_flags, pull_requests(title, author_login, repositories(full_name))'
    )
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`Failed to load analyses: ${error.message}`);
  }

  const candidates = (rows ?? []) as unknown as EvalAnalysisRow[];
  const targets = candidates
    .filter((r) => (r.risk_flags?.structural_diff ?? []).some(hasSymbolChanges))
    .slice(0, 5);

  if (targets.length === 0) {
    console.log('No completed analyses with structural changes found.');
    return;
  }

  let totalAnthropicCostCents = 0;

  for (const row of targets) {
    const structural = row.risk_flags?.structural_diff ?? [];
    const pr = row.pull_requests;
    const title = pr?.title ?? '(untitled)';
    const author = pr?.author_login ?? 'unknown';
    const repo = pr?.repositories?.full_name ?? '(unknown repo)';

    const additions = row.risk_flags?.additions ?? 0;
    const deletions = row.risk_flags?.deletions ?? 0;
    const fileCount = row.risk_flags?.file_count ?? structural.length;

    console.log(`\n${ANSI.bold}${ANSI.cyan}━━ ${repo} · ${title}${ANSI.reset}`);
    console.log(
      `${ANSI.dim}analysis=${row.id} commit=${row.commit_sha?.slice(0, 7) ?? '-'} author=${author}${ANSI.reset}`
    );

    try {
      const result = await analyzePR({
        prMeta: { title, author, filesChanged: fileCount, additions, deletions },
        structuralDiff: structural,
      });

      const tag = colorProvider(result.provider);
      console.log(`\n${tag} ${ANSI.bold}Summary:${ANSI.reset} ${result.summary}`);
      console.log(`${tag} ${ANSI.bold}Risk:${ANSI.reset}    ${colorRisk(result.riskLevel)}`);
      console.log(
        `${tag} ${ANSI.bold}Flags:${ANSI.reset}   ${result.riskFlags.length > 0 ? result.riskFlags.join(', ') : '(none)'}`
      );
      if (result.focusAreas.length > 0) {
        console.log(`${tag} ${ANSI.bold}Focus:${ANSI.reset}`);
        for (const f of result.focusAreas) {
          console.log(`  ${ANSI.magenta}${f.file}${ANSI.reset} (lines ${f.lines}) — ${f.reason}`);
        }
      }
      console.log(
        `${tag} ${ANSI.dim}tokens=${result.tokensUsed} cost=${formatCents(result.costUsdCents)}${ANSI.reset}`
      );

      if (result.provider === 'anthropic') {
        totalAnthropicCostCents += result.costUsdCents;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log(`${ANSI.red}analyze failed: ${message}${ANSI.reset}`);
    }
  }

  console.log(
    `\n${ANSI.bold}Total Anthropic spend across ${targets.length} runs: ${formatCents(totalAnthropicCostCents)}${ANSI.reset}`
  );
  console.log(`${ANSI.dim}(Gemini runs are free and excluded from the total.)${ANSI.reset}`);
}

function hasSymbolChanges(file: FileStructuralDiff): boolean {
  return file.summary.added + file.summary.modified + file.summary.removed > 0;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)} (${cents}¢)`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
