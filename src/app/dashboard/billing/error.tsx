'use client';

import { DashboardError } from '@features/dashboard/components/dashboard-error';

export default function BillingError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  return <DashboardError subject="your billing data" {...props} />;
}
