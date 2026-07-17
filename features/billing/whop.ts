import type { PlanName } from '@features/billing/plan-limits';

export type PaidPlanName = Exclude<PlanName, 'free'>;

const WHOP_API_BASE = 'https://api.whop.com/api/v1';

const PAID_PLAN_DETAILS: Record<PaidPlanName, { label: string; monthlyPrice: number }> = {
  starter: { label: 'Starter', monthlyPrice: 18 },
  team: { label: 'Team', monthlyPrice: 79 },
  pro: { label: 'Pro', monthlyPrice: 199 },
};

export type BillingPeriod = 'monthly' | 'yearly';

/**
 * Map each paid plan + billing period to the env var holding its Whop plan
 * ID (`plan_…`). These are pre-created Whop plans with their own hosted
 * checkout pages, so no plan needs to be created at runtime.
 */
const PLAN_ID_ENV_VARS: Record<PaidPlanName, Record<BillingPeriod, string>> = {
  starter: { monthly: 'WHOP_STARTER_MONTHLY_ID', yearly: 'WHOP_STARTER_YEARLY_ID' },
  team: { monthly: 'WHOP_TEAM_MONTHLY_ID', yearly: 'WHOP_TEAM_YEARLY_ID' },
  pro: { monthly: 'WHOP_PRO_MONTHLY_ID', yearly: 'WHOP_PRO_YEARLY_ID' },
};

/** Resolve the configured Whop plan ID for a plan + period, if any. */
export function whopPlanId(plan: PaidPlanName, period: BillingPeriod): string | null {
  return process.env[PLAN_ID_ENV_VARS[plan][period]]?.trim() || null;
}

/** Reverse lookup: which paid plan does a given Whop plan ID belong to. */
export function planForWhopPlanId(planId: string | null | undefined): PaidPlanName | null {
  if (!planId) return null;
  for (const plan of Object.keys(PLAN_ID_ENV_VARS) as PaidPlanName[]) {
    for (const period of ['monthly', 'yearly'] as BillingPeriod[]) {
      if (process.env[PLAN_ID_ENV_VARS[plan][period]]?.trim() === planId) {
        return plan;
      }
    }
  }
  return null;
}

/** Hosted Whop checkout URL for a pre-created plan ID. */
export function whopCheckoutUrlForPlanId(planId: string): string {
  return `https://whop.com/checkout/${encodeURIComponent(planId)}`;
}

// --- Credit packs (one-time top-up products) ---------------------------------

export type CreditPackName = 'small' | 'large';

/** Token grants per pack (confirmed 2026-07-17): $10 = 200k tokens, $25 = 600k. */
export const CREDIT_PACK_DETAILS: Record<CreditPackName, { label: string; price: number; credits: number }> = {
  small: { label: 'Small credit pack', price: 10, credits: 200_000 },
  large: { label: 'Large credit pack', price: 25, credits: 600_000 },
};

const CREDIT_PACK_ENV_VARS: Record<CreditPackName, { plan: string; product: string }> = {
  small: { plan: 'WHOP_CREDITS_SMALL_ID', product: 'WHOP_CREDITS_SMALL_PRODUCT_ID' },
  large: { plan: 'WHOP_CREDITS_LARGE_ID', product: 'WHOP_CREDITS_LARGE_PRODUCT_ID' },
};

/** Resolve the configured Whop plan ID for a credit pack, if any. */
export function creditPackPlanId(pack: CreditPackName): string | null {
  return process.env[CREDIT_PACK_ENV_VARS[pack].plan]?.trim() || null;
}

/**
 * Reverse lookup: which credit pack a Whop plan or product id belongs to.
 * Used by the payment.succeeded webhook to route one-time credit purchases
 * away from the subscription logic.
 */
export function creditPackForWhopIds(input: {
  planId?: string | null;
  productId?: string | null;
}): CreditPackName | null {
  for (const pack of Object.keys(CREDIT_PACK_ENV_VARS) as CreditPackName[]) {
    const vars = CREDIT_PACK_ENV_VARS[pack];
    if (input.planId && process.env[vars.plan]?.trim() === input.planId) return pack;
    if (input.productId && process.env[vars.product]?.trim() === input.productId) return pack;
  }
  return null;
}

/**
 * Resolve the Whop plan ID a checkout should use for a paid plan. Prefers the
 * period-specific pre-created plan ID (the secure SDK checkout path needs a
 * concrete plan_id), and returns null when none is configured so the caller
 * can surface a clear configuration error.
 */
export function resolveCheckoutPlanId(
  plan: PaidPlanName,
  period: BillingPeriod
): string | null {
  return whopPlanId(plan, period) ?? whopPlanId(plan, 'monthly');
}

export function whopProductIdForPlan(plan: PaidPlanName): string | null {
  switch (plan) {
    case 'starter':
      return process.env.WHOP_STARTER_PRODUCT_ID ?? null;
    case 'team':
      return process.env.WHOP_TEAM_PRODUCT_ID ?? null;
    case 'pro':
      return process.env.WHOP_PRO_PRODUCT_ID ?? null;
  }
}

export function planForWhopProductId(productId: string | null | undefined): PaidPlanName | null {
  if (!productId) return null;

  const entries: Array<[PaidPlanName, string | undefined]> = [
    ['starter', process.env.WHOP_STARTER_PRODUCT_ID],
    ['team', process.env.WHOP_TEAM_PRODUCT_ID],
    ['pro', process.env.WHOP_PRO_PRODUCT_ID],
  ];

  return entries.find(([, id]) => id === productId)?.[0] ?? null;
}

export async function createWhopCheckoutLink(input: {
  plan: PaidPlanName;
  productId: string;
  redirectUrl: string;
  prefillEmail: string | null;
}): Promise<string> {
  const apiKey = process.env.WHOP_API_KEY;
  if (!apiKey) {
    throw new Error('WHOP_API_KEY is not configured.');
  }

  const companyId = await resolveWhopCompanyId(apiKey, input.productId);
  const details = PAID_PLAN_DETAILS[input.plan];
  return getOrCreateWhopPlanCheckoutLink({
    apiKey,
    companyId,
    productId: input.productId,
    label: details.label,
    monthlyPrice: details.monthlyPrice,
  });
}

export async function cancelWhopMembership(membershipId: string): Promise<unknown> {
  const apiKey = process.env.WHOP_API_KEY;
  if (!apiKey) {
    throw new Error('WHOP_API_KEY is not configured.');
  }

  const response = await fetch(`${WHOP_API_BASE}/memberships/${encodeURIComponent(membershipId)}/cancel`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ cancel_at_period_end: true }),
  });

  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(readWhopError(payload, `Whop cancellation failed with ${response.status}.`));
  }

  return payload;
}

async function resolveWhopCompanyId(apiKey: string, productId: string): Promise<string> {
  if (process.env.WHOP_COMPANY_ID) {
    return process.env.WHOP_COMPANY_ID;
  }

  const response = await fetch(`${WHOP_API_BASE}/products/${encodeURIComponent(productId)}`, {
    headers: {
      authorization: `Bearer ${apiKey}`,
    },
  });

  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(readWhopError(payload, `Whop product lookup failed with ${response.status}.`));
  }

  const companyId =
    findFirstString(payload, [['company', 'id'], ['company_id'], ['data', 'company', 'id']]) ??
    null;

  if (!companyId) {
    throw new Error('Whop product lookup did not return a company ID.');
  }

  return companyId;
}

async function getOrCreateWhopPlanCheckoutLink(input: {
  apiKey: string;
  companyId: string;
  productId: string;
  label: string;
  monthlyPrice: number;
}): Promise<string> {
  const existing = await findExistingPlanCheckoutLink(input);
  if (existing) {
    return existing;
  }

  const response = await fetch(`${WHOP_API_BASE}/plans`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(
      buildWhopPlanPayload({
        companyId: input.companyId,
        productId: input.productId,
        label: input.label,
        monthlyPrice: input.monthlyPrice,
      })
    ),
  });

  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(readWhopError(payload, `Whop plan checkout failed with ${response.status}.`));
  }

  const url = findFirstString(payload, [['purchase_url'], ['data', 'purchase_url']]);
  if (!url) {
    throw new Error('Whop plan response did not include a checkout URL.');
  }

  return normalizeWhopUrl(url);
}

async function findExistingPlanCheckoutLink(input: {
  apiKey: string;
  companyId: string;
  productId: string;
  monthlyPrice: number;
}): Promise<string | null> {
  const params = new URLSearchParams({
    company_id: input.companyId,
    product_ids: input.productId,
  });

  const response = await fetch(`${WHOP_API_BASE}/plans?${params.toString()}`, {
    headers: {
      authorization: `Bearer ${input.apiKey}`,
    },
  });

  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(readWhopError(payload, `Whop plan lookup failed with ${response.status}.`));
  }

  const plans = readArray(payload, ['data']);
  const matchingPlan = plans.find((plan) => {
    if (!plan || typeof plan !== 'object') return false;
    const record = plan as Record<string, unknown>;

    return (
      numberEquals(record.renewal_price, input.monthlyPrice) &&
      numberEquals(record.initial_price, input.monthlyPrice) &&
      numberOrEmptyEquals(record.trial_period_days, 0)
    );
  });

  if (!matchingPlan) {
    return null;
  }

  return normalizeWhopUrl(
    findFirstString(matchingPlan, [['purchase_url'], ['direct_link']]) ??
      `/checkout/${String((matchingPlan as Record<string, unknown>).id)}`
  );
}

function buildWhopPlanPayload(input: {
  companyId: string;
  productId: string;
  label: string;
  monthlyPrice: number;
}) {
  return {
    company_id: input.companyId,
    product_id: input.productId,
    plan_type: 'renewal',
    release_method: 'buy_now',
    currency: 'usd',
    billing_period: 30,
    initial_price: input.monthlyPrice,
    renewal_price: input.monthlyPrice,
    title: `${input.label} Monthly`,
    description: `${input.label} plan for Senix.`,
    unlimited_stock: true,
    visibility: 'quick_link',
  };
}

function normalizeWhopUrl(value: string): string {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  if (value.startsWith('/')) {
    return `https://whop.com${value}`;
  }

  return `https://whop.com/${value}`;
}

function readArray(payload: unknown, path: string[]): unknown[] {
  const value = path.reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return null;
    return (current as Record<string, unknown>)[key];
  }, payload);

  return Array.isArray(value) ? value : [];
}

function numberEquals(value: unknown, expected: number): boolean {
  if (typeof value === 'number') {
    return Math.abs(value - expected) < 0.0001;
  }

  if (typeof value === 'string') {
    return Math.abs(Number(value) - expected) < 0.0001;
  }

  return false;
}

function numberOrEmptyEquals(value: unknown, expected: number): boolean {
  if (value === null || value === undefined || value === '') {
    return expected === 0;
  }

  return numberEquals(value, expected);
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function readWhopError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const record = payload as Record<string, unknown>;
  const message = record.error ?? record.message ?? record.detail;
  return typeof message === 'string' ? message : fallback;
}

function findFirstString(payload: unknown, paths: string[][]): string | null {
  for (const path of paths) {
    const value = path.reduce<unknown>((current, key) => {
      if (!current || typeof current !== 'object') return null;
      return (current as Record<string, unknown>)[key];
    }, payload);

    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return null;
}
