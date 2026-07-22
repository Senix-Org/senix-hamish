import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Proves: /api/checkout creates a Whop checkout configuration for both plan
 * upgrades and one-time credit packs, ties the session to the signed-in user via
 * metadata, and forwards a valid senix_ref affiliate cookie to the Whop embed.
 * Failure means: credit packs could not be purchased, or YouTube affiliate sales
 * would not be attributed.
 */

const h = vi.hoisted(() => ({
  checkoutCreate: vi.fn(),
  senixRefCookie: undefined as string | undefined,
  affiliates: [] as Array<{ code: string; active: boolean }>,
  userRows: [] as Array<{ auth_user_id: string; id: string }>,
  userLookupError: null as { message: string } | null,
}));

vi.mock('@features/shared/supabase-server', () => ({
  createServerSupabaseClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: 'auth-1', email: 'u@e.com' } },
        error: null,
      }),
    },
  }),
}));

vi.mock('@features/shared/supabase', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: h.userRows.find((r) => r.auth_user_id === 'auth-1') ?? null,
                error: h.userLookupError,
              }),
            }),
          }),
        };
      }
      if (table === 'affiliates') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: h.affiliates.find((a) => a.code === h.senixRefCookie && a.active) ?? null,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) };
    },
  },
}));

vi.mock('@/lib/whop-sdk', () => ({
  whopsdk: {
    checkoutConfigurations: {
      create: h.checkoutCreate,
    },
  },
}));

import { POST } from '@/app/api/checkout/route';

function makeRequest(body: unknown, cookies?: Record<string, string>): Request {
  const headers = new Headers({ 'content-type': 'application/json' });
  const req = new Request('https://app/api/checkout', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  // Attach a simple cookie getter for the route.
  Object.defineProperty(req, 'cookies', {
    value: {
      get: (name: string) => {
        const value = cookies?.[name];
        return value ? { name, value } : undefined;
      },
    },
    writable: true,
  });
  return req;
}

beforeEach(() => {
  h.checkoutCreate.mockReset();
  h.checkoutCreate.mockResolvedValue({
    id: 'sess_123',
    plan: { id: 'plan_123' },
    purchase_url: 'https://whop.com/checkout/sess_123',
  });
  h.userRows = [{ auth_user_id: 'auth-1', id: 'app-1' }];
  h.affiliates = [];
  h.senixRefCookie = undefined;
  h.userLookupError = null;
  process.env.NEXT_PUBLIC_SITE_URL = 'https://app';
  process.env.WHOP_CREDITS_SMALL_ID = 'plan_credits_small';
  process.env.WHOP_CREDITS_LARGE_ID = 'plan_credits_large';
  process.env.WHOP_STARTER_MONTHLY_ID = 'plan_starter_monthly';
  process.env.WHOP_TEAM_MONTHLY_ID = 'plan_team_monthly';
  process.env.WHOP_PRO_MONTHLY_ID = 'plan_pro_monthly';
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('/api/checkout', () => {
  it('creates a credit pack session with credits metadata', async () => {
    const req = makeRequest({ kind: 'credits', pack: 'small' });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    const payload = (await res.json()) as { sessionId: string; affiliateCode: string | null };

    expect(res.status).toBe(200);
    expect(payload.sessionId).toBe('sess_123');
    expect(h.checkoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_id: 'plan_credits_small',
        metadata: { user_id: 'app-1', kind: 'credits', pack: 'small' },
      })
    );
  });

  it('creates a plan session with plan metadata and period', async () => {
    const req = makeRequest({ kind: 'plan', plan: 'starter', period: 'monthly' });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    const payload = (await res.json()) as { sessionId: string; affiliateCode: string | null };

    expect(res.status).toBe(200);
    expect(payload.sessionId).toBe('sess_123');
    expect(h.checkoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_id: 'plan_starter_monthly',
        metadata: { user_id: 'app-1', plan: 'starter', period: 'monthly' },
      })
    );
  });

  it('forwards a valid senix_ref cookie as affiliateCode and stamps metadata', async () => {
    h.affiliates = [{ code: 'SENIX10', active: true }];
    h.senixRefCookie = 'SENIX10';

    const req = makeRequest({ kind: 'credits', pack: 'large' }, { senix_ref: 'SENIX10' });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    const payload = (await res.json()) as { sessionId: string; affiliateCode: string | null };

    expect(res.status).toBe(200);
    expect(payload.affiliateCode).toBe('SENIX10');
    expect(h.checkoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ affiliate_code: 'SENIX10' }),
      })
    );
  });

  it('ignores an invalid senix_ref cookie', async () => {
    h.affiliates = [{ code: 'SENIX10', active: true }];
    h.senixRefCookie = 'INVALID';

    const req = makeRequest({ kind: 'plan', plan: 'starter', period: 'monthly' }, { senix_ref: 'INVALID' });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    const payload = (await res.json()) as { sessionId: string; affiliateCode: string | null };

    expect(res.status).toBe(200);
    expect(payload.affiliateCode).toBeNull();
    expect(h.checkoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { user_id: 'app-1', plan: 'starter', period: 'monthly' },
      })
    );
  });

  it('rejects unknown credit packs', async () => {
    const req = makeRequest({ kind: 'credits', pack: 'huge' });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'Unknown credit pack.' });
  });

  it('rejects free plan checkout', async () => {
    const req = makeRequest({ kind: 'plan', plan: 'free' });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'Free plan does not need checkout.' });
  });
});
