import Link from 'next/link';
import { createServerSupabaseClient } from '@features/shared/supabase-server';
import { McpTokenManager, type McpTokenView } from '@features/dashboard/components/mcp-token-manager';
import { DashboardPageHeader } from '@features/dashboard/components/page-header';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type McpTokenRow = {
  id: string;
  name: string;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
};

/**
 * MCP token management. Lists the signed-in user's personal access
 * tokens (read through the RLS-scoped user client) and lets them
 * generate or revoke tokens for IDE integrations. Per-IDE config
 * snippets live on the Connect IDE page, which this page links to.
 */
export default async function TokensPage(): Promise<React.ReactElement> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('mcp_tokens')
    .select('id, name, last_used_at, created_at, revoked_at')
    .order('created_at', { ascending: false });

  const rows = (data ?? []) as unknown as McpTokenRow[];
  const tokens: McpTokenView[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    lastUsedAt: r.last_used_at,
    createdAt: r.created_at,
    revokedAt: r.revoked_at,
  }));

  return (
    <div>
      <DashboardPageHeader
        eyebrow="Integrations"
        title="MCP tokens"
        description={
          <>
            Tokens let your IDE connect to Senix. Generate a token, then head to{' '}
            <Link href="/dashboard/connect" className="text-accent hover:text-accent-hover">
              Connect IDE
            </Link>{' '}
            for a ready-to-paste config snippet.
          </>
        }
      />

      <section className="mt-8">
        <McpTokenManager tokens={tokens} />
      </section>
    </div>
  );
}
