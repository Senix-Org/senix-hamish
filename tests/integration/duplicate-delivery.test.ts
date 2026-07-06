import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * INTEGRATION (idempotency): the GitHub webhook route is hit twice with the
 * SAME x-github-delivery id. The first claims the delivery (its insert
 * lands) and is routed; the second hits the unique violation on the claim
 * insert and is skipped, so no second analysis (and thus no double comment)
 * is produced. Unlike the old processed-flag check, this holds even when the
 * two deliveries arrive concurrently, because the claim is the INSERT.
 * Failure means: GitHub retries would double-review PRs and spam comments.
 */

const { verifyGithubSignature, routeEvent } = vi.hoisted(() => ({
  verifyGithubSignature: vi.fn(() => true),
  routeEvent: vi.fn(async () => 'pull_request:opened'),
}));

// webhook_events claim: the first insert of a delivery id lands; once
// claimExists is set, further inserts fail with the 23505 unique violation.
let claimExists = false;

function makeQuery() {
  const obj: Record<string, unknown> = {};
  obj.insert = () => obj;
  obj.select = () => obj;
  obj.eq = () => obj;
  obj.update = () => obj;
  obj.single = () =>
    Promise.resolve(
      claimExists
        ? { data: null, error: { code: '23505', message: 'duplicate key value' } }
        : { data: { id: 'evt-row-1' }, error: null }
    );
  obj.then = (resolve: (v: { data: null; error: null }) => unknown) => resolve({ data: null, error: null });
  return obj;
}

vi.mock('@features/webhook/signature', () => ({ verifyGithubSignature }));
vi.mock('@features/webhook/route-event', () => ({ routeEvent }));
vi.mock('@features/shared/supabase', () => ({ supabaseAdmin: { from: () => makeQuery() } }));

import { POST } from '@/app/api/webhooks/github/route';

function delivery(id: string) {
  return {
    text: async () => JSON.stringify({ action: 'opened' }),
    headers: new Headers({
      'x-hub-signature-256': 'sha256=sig',
      'x-github-delivery': id,
      'x-github-event': 'pull_request',
    }),
  } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  process.env.GITHUB_WEBHOOK_SECRET = 'secret';
  claimExists = false;
  routeEvent.mockClear();
});

describe('webhook duplicate delivery', () => {
  it('routes the first delivery and dedupes the retry of the same delivery id', async () => {
    const first = await POST(delivery('D1'));
    expect(routeEvent).toHaveBeenCalledOnce();
    expect((await first.json()).ok).toBe(true);

    // Simulate the first delivery's claim row now existing.
    claimExists = true;

    const second = await POST(delivery('D1'));
    const body = await second.json();
    expect(body.deduped).toBe(true);
    // routeEvent must NOT be called a second time.
    expect(routeEvent).toHaveBeenCalledOnce();
  });

  it('still rejects an invalid signature before any claim/routing', async () => {
    verifyGithubSignature.mockReturnValueOnce(false);
    const res = await POST(delivery('D2'));
    expect(res.status).toBe(401);
    expect(routeEvent).not.toHaveBeenCalled();
  });
});
