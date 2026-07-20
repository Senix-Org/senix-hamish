import { supabaseAdmin } from '@features/shared/supabase';
import { createAffiliate, setCommissionStatus } from './actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type AffiliateRow = {
  id: string;
  code: string;
  name: string;
  payout_contact: string | null;
  created_at: string;
};

type CommissionRow = {
  id: string;
  payment_amount_cents: number;
  commission_cents: number;
  currency: string;
  status: 'unpaid' | 'paid';
  created_at: string;
  paid_at: string | null;
  affiliates: { code: string; name: string } | null;
  users: { github_username: string | null; email: string | null } | null;
};

function cents(v: number): string {
  return `$${(v / 100).toFixed(2)}`;
}

/**
 * Affiliate admin: create referrer records and track commission payouts.
 * Commission rows are written exclusively by the Whop payment webhook (10% of
 * a referred user's first subscription payment); this page only reads them
 * and flips paid/unpaid for manual payout bookkeeping.
 */
export default async function InternalAffiliatesPage() {
  const [{ data: affiliates }, { data: commissions }] = await Promise.all([
    supabaseAdmin
      .from('affiliates')
      .select('id, code, name, payout_contact, created_at')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('affiliate_commissions')
      .select(
        'id, payment_amount_cents, commission_cents, currency, status, created_at, paid_at, affiliates(code, name), users(github_username, email)'
      )
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  const affiliateList = (affiliates ?? []) as unknown as AffiliateRow[];
  const commissionList = (commissions ?? []) as unknown as CommissionRow[];
  const unpaidTotal = commissionList
    .filter((c) => c.status === 'unpaid')
    .reduce((s, c) => s + c.commission_cents, 0);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-8 font-mono text-sm">
      <h1 className="text-2xl font-bold mb-1">Affiliates</h1>
      <p className="text-zinc-500 mb-8">
        Unpaid commissions: <span className="text-yellow-400">{cents(unpaidTotal)}</span>
      </p>

      <section className="mb-10">
        <h2 className="text-lg font-bold mb-3">New affiliate</h2>
        <form action={createAffiliate} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            code (senix.dev/yt/…)
            <input
              name="code"
              required
              pattern="[a-z0-9-]{2,40}"
              placeholder="mkbhd"
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            name
            <input
              name="name"
              required
              placeholder="Marques"
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            payout contact
            <input
              name="payout_contact"
              placeholder="paypal@example.com"
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
            />
          </label>
          <button
            type="submit"
            className="rounded border border-zinc-600 px-3 py-1 hover:bg-zinc-800"
          >
            Create
          </button>
        </form>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-bold mb-3">Affiliates ({affiliateList.length})</h2>
        <div className="space-y-1">
          {affiliateList.map((a) => (
            <div key={a.id} className="flex gap-4 text-zinc-300">
              <span className="w-40 text-blue-300">/yt/{a.code}</span>
              <span className="w-48">{a.name}</span>
              <span className="w-64 text-zinc-500">{a.payout_contact ?? '-'}</span>
              <span className="text-zinc-600">{new Date(a.created_at).toLocaleDateString()}</span>
            </div>
          ))}
          {affiliateList.length === 0 && <p className="text-zinc-600">None yet.</p>}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3">Commission ledger ({commissionList.length})</h2>
        <div className="space-y-1">
          {commissionList.map((c) => (
            <div key={c.id} className="flex items-center gap-4 text-zinc-300">
              <span className="w-40 truncate text-blue-300">{c.affiliates?.code ?? '?'}</span>
              <span className="w-48 truncate">
                {c.users?.github_username ?? c.users?.email ?? 'unknown user'}
              </span>
              <span className="w-24">{cents(c.payment_amount_cents)}</span>
              <span className="w-24 font-bold text-green-300">{cents(c.commission_cents)}</span>
              <span className={c.status === 'paid' ? 'w-16 text-green-400' : 'w-16 text-yellow-400'}>
                {c.status}
              </span>
              <span className="w-28 text-zinc-600">
                {new Date(c.created_at).toLocaleDateString()}
              </span>
              <form action={setCommissionStatus}>
                <input type="hidden" name="commission_id" value={c.id} />
                <input
                  type="hidden"
                  name="next_status"
                  value={c.status === 'paid' ? 'unpaid' : 'paid'}
                />
                <button
                  type="submit"
                  className="rounded border border-zinc-700 px-2 py-0.5 text-xs hover:bg-zinc-800"
                >
                  mark {c.status === 'paid' ? 'unpaid' : 'paid'}
                </button>
              </form>
            </div>
          ))}
          {commissionList.length === 0 && (
            <p className="text-zinc-600">No commissions yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
