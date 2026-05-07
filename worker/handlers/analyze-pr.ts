import { supabaseAdmin } from '../../src/lib/supabase';
import { fetchPRFiles, fetchFileContent } from '../../src/server/github-diff';
import { diffFile, FileStructuralDiff } from '../../src/lib/structural-diff';
import { detectLanguage } from '../../src/lib/parser';
import { analyzePR, AnalysisResult } from '../../src/lib/llm';
import { isOverDailyCostCap } from '../../src/lib/cost-tracker';
import { formatPRComment } from '../../src/lib/format-comment';
import { upsertPRComment } from '../../src/server/github-comments';
import type { JobPayloadMap } from '../../src/lib/queue';

const MAX_FILES_FOR_STRUCTURAL_DIFF = 50;
const DEFAULT_DASHBOARD_URL = 'https://senix.vercel.app';

type PrRow = { title: string | null; author_login: string | null };
type InstallationStatusRow = { uninstalled_at: string | null };
type PriorCommentRow = { github_comment_id: number | null };
type CommentOutcome = { commentId: number | null; commentUrl: string | null; postError: string | null };
type CommentContext = { pullRequestId: string; installationId: number; owner: string; repo: string; prNumber: number };

/**
 * Process an `analyze-pr` job: fetch the PR diff, build a per-file
 * structural diff, ask the active LLM provider for a behavioral summary,
 * post (or update) the customer-facing PR comment, and persist the result.
 * LLM and comment failures are recorded in `error_message` but never
 * escalate to a hard analysis failure — the structural diff is still useful.
 */
export async function processAnalyzePr(
  payload: JobPayloadMap['analyze-pr']
): Promise<void> {
  const { analysisId, pullRequestId, installationId, owner, repo, prNumber, headSha, baseSha } =
    payload;

  const { data: installRow } = await supabaseAdmin
    .from('installations')
    .select('uninstalled_at')
    .eq('github_installation_id', installationId)
    .maybeSingle();
  const installation = (installRow ?? null) as unknown as InstallationStatusRow | null;

  if (installation?.uninstalled_at) {
    console.log(
      `[worker] skipping job — installation uninstalled (id=${installationId}, at=${installation.uninstalled_at})`
    );
    await supabaseAdmin
      .from('analyses')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        error_message: 'skipped: installation uninstalled',
      })
      .eq('id', analysisId);
    return;
  }

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
        const beforeContent =
          file.status === 'added'
            ? null
            : await fetchFileContent(
                installationId,
                owner,
                repo,
                file.previous_filename ?? file.filename,
                baseSha
              );
        const afterContent =
          file.status === 'removed'
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

    const comment: CommentOutcome = llmResult
      ? await postPRComment({ pullRequestId, installationId, owner, repo, prNumber }, llmResult)
      : { commentId: null, commentUrl: null, postError: null };

    const errorMessage =
      [llmError, comment.postError].filter((p): p is string => Boolean(p)).join(' | ') || null;

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
        error_message: errorMessage,
        risk_flags: {
          file_count: files.length,
          supported_file_count: supportedFiles.length,
          additions: totalAdditions,
          deletions: totalDeletions,
          symbol_changes: symbolChangeCount,
          structural_diff: structural,
          sample_files: files.slice(0, 5).map((f) => f.filename),
          detected_risks: llmResult?.riskFlags ?? [],
        },
        github_comment_id: comment.commentId,
        github_comment_url: comment.commentUrl,
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

async function postPRComment(
  ctx: CommentContext,
  llmResult: AnalysisResult
): Promise<CommentOutcome> {
  if (process.env.POST_PR_COMMENTS !== 'true') {
    console.log('[worker] skipping PR comment (POST_PR_COMMENTS != true)');
    return { commentId: null, commentUrl: null, postError: null };
  }

  const { data: priorRow } = await supabaseAdmin
    .from('analyses')
    .select('github_comment_id')
    .eq('pull_request_id', ctx.pullRequestId)
    .not('github_comment_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const prior = (priorRow ?? null) as unknown as PriorCommentRow | null;
  const existingCommentId = prior?.github_comment_id ?? null;

  const dashboardUrl = `${process.env.DASHBOARD_URL || DEFAULT_DASHBOARD_URL}/internal/test`;
  const body = formatPRComment({
    summary: llmResult.summary,
    riskLevel: llmResult.riskLevel,
    riskFlags: llmResult.riskFlags,
    focusAreas: llmResult.focusAreas,
    provider: llmResult.provider,
    tokensUsed: llmResult.tokensUsed,
    costUsdCents: llmResult.costUsdCents,
    dashboardUrl,
  });

  try {
    const { commentId, commentUrl } = await upsertPRComment({
      installationId: ctx.installationId,
      owner: ctx.owner,
      repo: ctx.repo,
      prNumber: ctx.prNumber,
      commentBody: body,
      existingCommentId,
    });
    console.log(`[worker] posted comment ${commentId} on ${ctx.owner}/${ctx.repo}#${ctx.prNumber}`);
    return { commentId, commentUrl, postError: null };
  } catch (err: any) {
    const message = err?.message ?? String(err);
    console.error(`[worker] comment post failed: ${message}`);
    return { commentId: null, commentUrl: null, postError: message };
  }
}
