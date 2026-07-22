import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Proves: the first review POSTs a new PR comment, and a subsequent review
 * PATCHes (updates) the existing comment instead of creating a duplicate.
 * If the existing comment was deleted (404 on PATCH) it falls back to POST.
 * Every posted body carries the branded Senix footer exactly once, even
 * across upserts.
 * Failure means: every push would spam the PR with a new Senix comment, or
 * comments would ship without attribution / with stacked footers.
 */

const { request } = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@features/github-integration/github-app', () => ({
  getInstallationOctokit: () => ({ request }),
}));

import { upsertPRComment } from '@features/github-integration/github-comments';

beforeEach(() => request.mockReset());

const base = { installationId: 1, owner: 'o', repo: 'r', prNumber: 9, commentBody: 'body' };

describe('upsertPRComment', () => {
  it('creates a new comment on the first review (no existing id)', async () => {
    request.mockResolvedValue({ data: { id: 100, html_url: 'https://gh/c/100' } });
    const res = await upsertPRComment({ ...base, existingCommentId: null });
    expect(res.commentId).toBe(100);
    expect(request.mock.calls[0][0]).toContain('POST');
  });

  it('updates the existing comment on a subsequent review (no duplicate)', async () => {
    request.mockResolvedValue({ data: { id: 100, html_url: 'https://gh/c/100' } });
    const res = await upsertPRComment({ ...base, existingCommentId: 100 });
    expect(res.commentId).toBe(100);
    expect(request.mock.calls[0][0]).toContain('PATCH');
    // Exactly one request: an update, never a second POST.
    expect(request).toHaveBeenCalledOnce();
  });

  it('falls back to POST when the existing comment was deleted (PATCH 404)', async () => {
    request
      .mockRejectedValueOnce({ status: 404 })
      .mockResolvedValueOnce({ data: { id: 200, html_url: 'https://gh/c/200' } });
    const res = await upsertPRComment({ ...base, existingCommentId: 100 });
    expect(res.commentId).toBe(200);
    expect(request.mock.calls[0][0]).toContain('PATCH');
    expect(request.mock.calls[1][0]).toContain('POST');
  });

  it('appends the branded Senix footer with a clickable senix.dev link', async () => {
    request.mockResolvedValue({ data: { id: 100, html_url: 'https://gh/c/100' } });
    await upsertPRComment({ ...base, existingCommentId: null });
    const sent = request.mock.calls[0][1].body as string;
    expect(sent.startsWith('body')).toBe(true);
    expect(sent).toContain('\n\n---\n');
    expect(sent).toContain('Reviewed by [Senix](https://senix.dev)');
  });

  it('does not duplicate the footer when updating a body that already has one', async () => {
    request.mockResolvedValue({ data: { id: 100, html_url: 'https://gh/c/100' } });
    // Simulate the upsert path re-sending an already-footered body.
    const footered = 'body\n\n---\n*Reviewed by [Senix](https://senix.dev) · AI code review for teams shipping with AI*';
    await upsertPRComment({ ...base, commentBody: footered, existingCommentId: 100 });
    const sent = request.mock.calls[0][1].body as string;
    expect(sent.match(/Reviewed by \[Senix\]/g)).toHaveLength(1);
  });
});
