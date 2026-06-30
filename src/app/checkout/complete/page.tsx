import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Checkout complete',
  description: 'Your Senix subscription is being activated.',
  path: '/checkout/complete',
});

/**
 * Landing page after a Whop checkout. Payment confirmation is authoritative
 * only once the verified webhook updates Supabase, so this page intentionally
 * does not read or trust any status from the URL. It just reassures the user
 * and points them back to billing, which reflects the real plan state.
 */
export default function CheckoutCompletePage(): React.ReactElement {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <CheckCircle2 size={44} className="text-green-500" />
      <h1 className="mt-5 text-2xl font-semibold text-zinc-100">Thanks for subscribing</h1>
      <p className="mt-3 leading-relaxed text-zinc-400">
        Your payment was received. We are activating your plan now. This usually takes a few
        seconds. Your billing page will show the updated plan once it is confirmed.
      </p>
      <Link
        href="/dashboard/billing"
        className="mt-7 inline-flex items-center justify-center rounded-md bg-green-500 px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-green-400"
      >
        Go to billing
      </Link>
    </main>
  );
}
