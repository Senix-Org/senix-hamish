import { getInstallationOctokit } from '@features/github-integration/github-app';

/**
 * Branded footer appended to every comment Senix posts (reviews, limit
 * notices, MCP-delivered reviews) — this function is the single choke point
 * they all go through, so the branding can never be missed by a new comment
 * type. Markdown so the senix.dev link is clickable on GitHub, separated
 * from the review content by a horizontal rule.
 */
const SENIX_FOOTER = `\n\n---\n*Reviewed by [Senix](https://senix.dev) · AI code review for teams shipping with AI*`;

/** Marker used to detect an existing footer so upserts never duplicate it. */
const FOOTER_MARKER = 'Reviewed by [Senix]';

export function addFooter(body: string): string {
  if (body.includes(FOOTER_MARKER)) return body;
  return `${body}${SENIX_FOOTER}`;
}

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
  const { installationId, owner, repo, prNumber, existingCommentId } = input;
  const commentBody = addFooter(input.commentBody);
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
