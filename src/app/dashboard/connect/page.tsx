import { ConnectIde } from '@features/dashboard/components/connect-ide';
import { DashboardPageHeader } from '@features/dashboard/components/page-header';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function ConnectPage(): React.ReactElement {
  return (
    <div>
      <DashboardPageHeader
        eyebrow="Integrations"
        title="Connect your IDE"
        description="Pick your IDE, copy the config, restart. You are done."
      />

      <div className="mt-8">
        <ConnectIde />
      </div>
    </div>
  );
}
