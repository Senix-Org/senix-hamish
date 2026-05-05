import { getInstallationOctokit } from '@/lib/github-app';

export type UpsertPRCommentInput = {
  installationId: number;
  owner: string;
  repo: string;
  prNumber: number;
  commentBody: string;
  existingCommentId: number | null;
};

export type UpsertPRCommentResult = {
  commentId: number;
  commentUrl: string;
};

type GithubCommentResponse = {
  id: number;
  html_url: string;
};

/**
 * Create or update the Senix PR comment for a pull request.
 *
 * If `existingCommentId` is provided, PATCHes the existing comment so the
 * reviewer thread isn't spammed on every push. If the PATCH 404s (someone
 * deleted the comment manually), falls back to POSTing a fresh one.
 *
 * Throws with a `[github-comments]` prefix on any other failure so the
 * worker can record the error and continue.
 */
export async function upsertPRComment(
  input: UpsertPRCommentInput
): Promise<UpsertPRCommentResult> {
  const { installationId, owner, repo, prNumber, commentBody, existingCommentId } = input;
  const octokit = getInstallationOctokit(installationId);

  if (existingCommentId !== null) {
    try {
      const { data } = await octokit.request(
        'PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}',
        {
          owner,
          repo,
          comment_id: existingCommentId,
          body: commentBody,
        }
      );
      const comment = data as GithubCommentResponse;
      return { commentId: comment.id, commentUrl: comment.html_url };
    } catch (err: any) {
      if (err?.status !== 404) {
        throw new Error(
          `[github-comments] failed to update comment on ${owner}/${repo}#${prNumber}: ${err?.message ?? String(err)}`
        );
      }
      // 404 — fall through to POST a new comment
    }
  }

  try {
    const { data } = await octokit.request(
      'POST /repos/{owner}/{repo}/issues/{issue_number}/comments',
      {
        owner,
        repo,
        issue_number: prNumber,
        body: commentBody,
      }
    );
    const comment = data as GithubCommentResponse;
    return { commentId: comment.id, commentUrl: comment.html_url };
  } catch (err: any) {
    throw new Error(
      `[github-comments] failed to post comment on ${owner}/${repo}#${prNumber}: ${err?.message ?? String(err)}`
    );
  }
}
