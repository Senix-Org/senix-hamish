'use client';

import { DashboardError } from '@features/dashboard/components/dashboard-error';

export default function TokensError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  return <DashboardError subject="your tokens" {...props} />;
}
