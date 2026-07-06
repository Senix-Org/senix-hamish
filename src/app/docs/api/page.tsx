import type { Metadata } from 'next';
import {
  DocBadge,
  DocCallout,
  DocH2,
  DocLink,
  DocP,
  DocPageHeader,
  DocTable,
  DocUL,
} from '@features/shared/components/docs/doc-elements';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'API reference',
  description: 'The Senix REST API — coming soon.',
  path: '/docs/api',
});

export default function ApiDocsPage(): React.ReactElement {
  return (
    <>
      <DocPageHeader
        badge={<DocBadge variant="soon">Coming soon</DocBadge>}
        title="API reference"
        lead={
          <>
            A public REST API is on the roadmap. Today, Senix is consumed through the GitHub
            App and the MCP server. Both cover the common workflows without writing API code.
          </>
        }
      />

      <DocCallout variant="info" title="Need something now?">
        The MCP <code className="rounded border border-surface-border bg-surface-raised px-1.5 py-0.5 font-mono text-xs">review_changes</code>{' '}
        tool exposes the same analysis surface we plan to ship as{' '}
        <code className="rounded border border-surface-border bg-surface-raised px-1.5 py-0.5 font-mono text-xs">POST /v1/analyze</code>.
        See <DocLink href="/docs/mcp">MCP for IDEs</DocLink>.
      </DocCallout>

      <DocH2>Planned endpoints</DocH2>
      <DocTable
        head={['Endpoint', 'Description']}
        rows={[
          [
            <code key="a" className="font-mono text-sm text-accent-hover">GET /v1/analyses</code>,
            'List analyses for your repositories, with filtering by repo, risk level, and date.',
          ],
          [
            <code key="b" className="font-mono text-sm text-accent-hover">GET /v1/analyses/:id</code>,
            'Fetch a single analysis, including the structural diff and risk flags.',
          ],
          [
            <code key="c" className="font-mono text-sm text-accent-hover">POST /v1/analyze</code>,
            'Run an analysis on an arbitrary diff, the same surface the MCP tool uses.',
          ],
          [
            <strong key="d" className="text-primary">Webhooks</strong>,
            'Subscribe to analysis-completed events to pipe results into your own tools.',
          ],
          [
            <strong key="e" className="text-primary">API keys</strong>,
            'Scoped, revocable keys managed from the dashboard, mirroring MCP tokens.',
          ],
        ]}
      />

      <DocH2>What you get today</DocH2>
      <DocUL>
        <li>GitHub App for automatic PR reviews</li>
        <li>MCP server for IDE integration</li>
        <li>Dashboard for history and analysis detail</li>
      </DocUL>

      <DocP>
        If a specific endpoint would unblock you, tell us via the Feedback button in the
        dashboard. It helps us prioritize.
      </DocP>
    </>
  );
}
