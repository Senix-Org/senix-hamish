'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { WhopCheckoutDialog } from '@/components/whop-checkout-dialog';
import type { PlanName } from '@features/billing/plans';

type BillingPeriod = 'monthly' | 'yearly';
type PaidPlan = Exclude<PlanName, 'free'>;

type Props = {
  plan: PlanName;
  label: string;
  highlight?: boolean;
  period?: BillingPeriod;
};

export function PricingCheckoutButton({
  plan,
  label,
  highlight = false,
  period = 'monthly',
}: Props): React.ReactElement {
  const [open, setOpen] = useState(false);

  if (plan === 'free') {
    return (
      <Link href="/login" className="btn-senix btn-senix-primary mt-7 w-full !h-auto py-3">
        {label}
        <ArrowRight size={15} />
      </Link>
    );
  }

  return (
    <div className="mt-7 flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`btn-senix w-full !h-auto py-3 ${
          highlight ? 'btn-senix-primary' : 'btn-senix-secondary'
        }`}
      >
        <ArrowRight size={15} />
        {label}
      </button>
      {open && (
        <WhopCheckoutDialog
          kind="plan"
          plan={plan as PaidPlan}
          period={period}
          loginRedirect="/pricing"
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
