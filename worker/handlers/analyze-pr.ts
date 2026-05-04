import { supabaseAdmin } from '../../src/lib/supabase';
import { fetchPRFiles, fetchFileContent } from '../../src/server/github-diff';
import { diffFile, FileStructuralDiff } from '../../src/lib/structural-diff';
import { detectLanguage } from '../../src/lib/parser';
import { analyzePR, AnalysisResult } from '../../src/lib/llm';
import { isOverDailyCostCap } from '../../src/lib/cost-tracker';
import type { JobPayloadMap } from '../../src/lib/queue';

const MAX_FILES_FOR_STRUCTURAL_DIFF = 50;

type PrRow = {
  title: string | null;
  author_login: string | null;
};

/**
 * Process an `analyze-pr` job: fetch the PR diff, build a per-file
 * structural diff, ask the active LLM provider for a behavioral summary,
 * and persist the combined result. The structural diff alone is considered
 * useful, so an LLM failure does not fail the whole analysis — we save the
 * structural data and record the LLM error in `error_message`.
 */
export async function processAnalyzePr(
  payload: JobPayloadMap['analyze-pr']
): Promise<void> {
  const { analysisId, pullRequestId, installationId, owner, repo, prNumber, headSha, baseSha } =
    payload;

  await supabaseAdmin.from('analyses').update({ status: 'running' }).eq('id', analysisId);

  try {
    const { data: prRow } = await supabaseAdmin
      .from('pull_requests')
      .select('title, author_login')
      .eq('id', pullRequestId)
      .single();

    const pr = (prRow ?? null) as unknown as PrRow | null;

    const files = await fetchPRFiles(installationId, owner, repo, prNumber);
    const supportedFiles = files.filter((f) => detectLanguage(f.filename) !== null);

    const structural: FileStructuralDiff[] = [];

    if (supportedFiles.length <= MAX_FILES_FOR_STRUCTURAL_DIFF) {
      for (const file of supportedFiles) {
        const isAdded = file.status === 'added';
        const isRemoved = file.status === 'removed';

        const beforeContent = isAdded
          ? null
          : await fetchFileContent(
              installationId,
              owner,
              repo,
              file.previous_filename ?? file.filename,
              baseSha
            );
        const afterContent = isRemoved
          ? null
          : await fetchFileContent(installationId, owner, repo, file.filename, headSha);

        structural.push(diffFile(file.filename, beforeContent, afterContent));
      }
    }

    const totalAdditions = files.reduce((s, f) => s + (f.additions || 0), 0);
    const totalDeletions = files.reduce((s, f) => s + (f.deletions || 0), 0);
    const symbolChangeCount = structural.reduce(
      (s, f) => s + f.summary.added + f.summary.modified + f.summary.removed,
      0
    );

    let llmResult: AnalysisResult | null = null;
    let llmError: string | null = null;

    if (await isOverDailyCostCap()) {
      llmError = 'Daily cost cap exceeded — LLM analysis skipped';
      console.warn(`[analyze-pr] ${analysisId}: ${llmError}`);
    } else {
      try {
        llmResult = await analyzePR({
          prMeta: {
            title: pr?.title ?? `PR #${prNumber}`,
            author: pr?.author_login ?? 'unknown',
            filesChanged: files.length,
            additions: totalAdditions,
            deletions: totalDeletions,
          },
          structuralDiff: structural,
        });
        console.log(
          `[worker] analyzed via ${llmResult.provider}, cost=${llmResult.costUsdCents}¢, tokens=${llmResult.tokensUsed}`
        );
      } catch (err: any) {
        llmError = `LLM analysis failed: ${err?.message ?? String(err)}`;
        console.error(`[analyze-pr] ${analysisId}: ${llmError}`);
      }
    }

    const baseRiskFlags = {
      file_count: files.length,
      supported_file_count: supportedFiles.length,
      additions: totalAdditions,
      deletions: totalDeletions,
      symbol_changes: symbolChangeCount,
      structural_diff: structural,
      sample_files: files.slice(0, 5).map((f) => f.filename),
      detected_risks: llmResult?.riskFlags ?? [],
    };

    await supabaseAdmin
      .from('analyses')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        summary: llmResult?.summary ?? null,
        risk_level: llmResult?.riskLevel ?? null,
        focus_areas: llmResult?.focusAreas ?? [],
        tokens_used: llmResult?.tokensUsed ?? null,
        cost_usd_cents: llmResult?.costUsdCents ?? null,
        error_message: llmError,
        risk_flags: baseRiskFlags,
      })
      .eq('id', analysisId);
  } catch (err: any) {
    await supabaseAdmin
      .from('analyses')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: err?.message ?? String(err),
      })
      .eq('id', analysisId);
    throw err;
  }
}
