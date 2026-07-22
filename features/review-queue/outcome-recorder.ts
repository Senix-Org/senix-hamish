import { supabaseAdmin } from '@features/shared/supabase';

/**
 * Review outcome recording (migration 014).
 *
 * Every completed review becomes a labeled training example once we know
 * what happened afterward: merged despite a high-risk verdict, commits
 * pushed after the review (pushback), and post-merge hotfixes (recorded
 * separately by the daily check-hotfixes cron).
 *
 * Everything here is best-effort by design: the exported functions catch
 * and log their own failures and never throw, so outcome bookkeeping can
 * never break webhook handling or the review flow. This module must never
 * be imported from the review critical path (the LLM call); it is called
 * from webhook handlers only.
 *
 * Note on identity: the spec sketch matched analyses by pr_number and
 * repo_full_name columns, which do not exist on the analyses table. The
 * real schema joins analyses -> pull_requests -> repositories, so the
 * lookup goes through those tables instead.
 */

type AnalysisOutcomeRow = {
  id: string;
  risk_level: string | null;
  commits_after_review: number | null;
};

/**
 * Latest completed analysis for a PR, found via
 * repositories.full_name -> pull_requests.github_pr_number -> analyses.
 */
async function findLatestCompletedAnalysis(
  prNumber: number,
  repoFullName: string
): Promise<AnalysisOutcomeRow | null> {
  const { data: repoRow } = await supabaseAdmin
    .from('repositories')
    .select('id')
    .eq('full_name', repoFullName)
    .maybeSingle();
  const repo = (repoRow ?? null) as unknown as { id: string } | null;
  if (!repo) return null;

  const { data: prRow } = await supabaseAdmin
    .from('pull_requests')
    .select('id')
    .eq('repository_id', repo.id)
    .eq('github_pr_number', prNumber)
    .maybeSingle();
  const pr = (prRow ?? null) as unknown as { id: string } | null;
  if (!pr) return null;

  const { data: analysisRow } = await supabaseAdmin
    .from('analyses')
    .select('id, risk_level, commits_after_review')
    .eq('pull_request_id', pr.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (analysisRow ?? null) as unknown as AnalysisOutcomeRow | null;
}

/**
 * Record the close/merge outcome on the latest completed review of a PR.
 * On merge, also schedules the 24h hotfix scan (hotfix_check_after) that
 * the daily cron picks up. No completed review means nothing to label.
 */
export async function recordPROutcome(input: {
  prNumber: number;
  repoFullName: string;
  merged: boolean;
  mergedAt: string | null;
  closedAt: string | null;
}): Promise<void> {
  try {
    const analysis = await findLatestCompletedAnalysis(input.prNumber, input.repoFullName);
    if (!analysis) return;

    const update: Record<string, unknown> = {
      pr_closed_at: input.closedAt ?? new Date().toISOString(),
      outcome_recorded_at: new Date().toISOString(),
    };

    if (input.merged) {
      const mergedAt = input.mergedAt ?? new Date().toISOString();
      // "Shipped anyway": merged while the latest verdict was high/critical.
      update.developer_shipped =
        analysis.risk_level === 'high' || analysis.risk_level === 'critical';
      update.pr_merged_at = mergedAt;
      update.hotfix_check_after = new Date(
        new Date(mergedAt).getTime() + 24 * 60 * 60 * 1000
      ).toISOString();
    }

    const { error } = await supabaseAdmin.from('analyses').update(update).eq('id', analysis.id);
    if (error) {
      console.error('[outcome-recorder] failed to record PR outcome', {
        prNumber: input.prNumber,
        repoFullName: input.repoFullName,
        message: error.message,
      });
    }
  } catch (err) {
    console.error('[outcome-recorder] recordPROutcome failed', {
      prNumber: input.prNumber,
      repoFullName: input.repoFullName,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Count a post-review push (pull_request.synchronize) against the latest
 * completed review of the PR — a proxy for developer pushback. Best-effort
 * read-then-write; a lost increment under concurrent pushes is acceptable
 * for this signal.
 */
export async function incrementCommitsAfterReview(input: {
  prNumber: number;
  repoFullName: string;
}): Promise<void> {
  try {
    const analysis = await findLatestCompletedAnalysis(input.prNumber, input.repoFullName);
    if (!analysis) return;

    const { error } = await supabaseAdmin
      .from('analyses')
      .update({ commits_after_review: (analysis.commits_after_review ?? 0) + 1 })
      .eq('id', analysis.id);
    if (error) {
      console.error('[outcome-recorder] failed to increment commits_after_review', {
        prNumber: input.prNumber,
        repoFullName: input.repoFullName,
        message: error.message,
      });
    }
  } catch (err) {
    console.error('[outcome-recorder] incrementCommitsAfterReview failed', {
      prNumber: input.prNumber,
      repoFullName: input.repoFullName,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
