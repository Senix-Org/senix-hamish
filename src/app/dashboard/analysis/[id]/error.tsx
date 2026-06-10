'use client';

import { DashboardError } from '@features/dashboard/components/dashboard-error';

export default function AnalysisError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  return <DashboardError subject="this review" {...props} />;
}
