'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { WhopCheckoutDialog } from '@/components/whop-checkout-dialog';

type PlanName = 'free' | 'starter' | 'team' | 'pro';
type PaidPlan = Exclude<PlanName, 'free'>;

type Props = {
  plan: PlanName;
  label: string;
  highlight?: boolean;
};

export function PricingCheckoutButton({
  plan,
  label,
  highlight = false,
}: Props): React.ReactElement {
  const [open, setOpen] = useState(false);

  if (plan === 'free') {
    return (
      <Link
        href="/login"
        className="mt-8 inline-flex items-center justify-center gap-1.5 rounded-md bg-green-500 px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-green-400"
      >
        {label}
        <ArrowRight size={15} />
      </Link>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2.5 text-sm font-medium transition ${
          highlight
            ? 'bg-green-500 text-zinc-950 hover:bg-green-400'
            : 'border border-zinc-700 text-zinc-100 hover:border-zinc-600 hover:bg-zinc-800/40'
        }`}
      >
        <ArrowRight size={15} />
        {label}
      </button>
      {open && (
        <WhopCheckoutDialog
          plan={plan as PaidPlan}
          loginRedirect="/pricing"
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
