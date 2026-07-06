import type { Metadata } from 'next';
import {
  DocH2,
  DocIssue,
  DocLink,
  DocPageHeader,
  InlineCode,
} from '@features/shared/components/docs/doc-elements';
import { getMcpServerUrl } from '@features/shared/mcp-config';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Troubleshooting',
  description: 'Common Senix issues, their causes, and how to fix them.',
  path: '/docs/troubleshooting',
});

export default function TroubleshootingPage(): React.ReactElement {
  return (
    <>
      <DocPageHeader
        title="Troubleshooting"
        lead={
          <>
            Common issues and how to resolve them. If none of these match, use the{' '}
            <strong className="text-primary">Feedback</strong> button in your dashboard.
          </>
        }
      />

      <DocH2>Common issues</DocH2>
      <div className="space-y-4">
        <DocIssue
          title="My PR didn't get a comment"
          cause={
            <>
              The repo is disabled on your dashboard, webhook delivery failed, or the PR only
              touches unsupported file types.
            </>
          }
          fix={
            <>
              Confirm the repo toggle is on. Then open the installation at{' '}
              <InlineCode>github.com/settings/installations</InlineCode> and check{' '}
              <strong className="text-primary">Recent Deliveries</strong> for failed webhooks.
              PRs with no JS, TS, TSX, or Python files still get a review, just without
              structural detail.
            </>
          }
        />

        <DocIssue
          title="The bot comment didn't update on a new push"
          cause={
            <>
              Senix updates the existing comment in place rather than posting a new one, so
              GitHub does not bubble it to the top of the thread.
            </>
          }
          fix={
            <>
              Refresh the PR page. If the comment body still looks stale, analysis for the latest
              push may still be running. It completes within about 60 seconds.
            </>
          }
        />

        <DocIssue
          title="I got an unexpected risk level"
          cause={
            <>
              Risk level is calibrated by impact-if-shipped-wrong, not by diff size. A one-line
              change to pricing logic is high; a 500-line refactor with no behavior change is
              low.
            </>
          }
          fix={
            <>
              Check the risk flags on the comment. They explain the level. If it still looks
              wrong, send the PR URL via <strong className="text-primary">Feedback</strong> and
              we&apos;ll fold it into the next eval run. See the{' '}
              <DocLink href="/docs/risk-flags">risk flag reference</DocLink>.
            </>
          }
        />

        <DocIssue
          title="MCP tool not appearing in my IDE"
          cause={
            <>
              The MCP config is malformed, in the wrong file, or the IDE has not reloaded it.
            </>
          }
          fix={
            <>
              Verify the JSON is valid and the <InlineCode>url</InlineCode> is{' '}
              <InlineCode>{getMcpServerUrl()}</InlineCode>. Fully restart the IDE so it
              re-reads the config. Check your IDE&apos;s MCP panel for a connection error.
            </>
          }
        />

        <DocIssue
          title="MCP returns Unauthorized"
          cause={
            <>
              The token is missing, mistyped, revoked, or the{' '}
              <InlineCode>Authorization</InlineCode> header is not formatted as{' '}
              <InlineCode>Bearer &lt;token&gt;</InlineCode>.
            </>
          }
          fix={
            <>
              Go to <strong className="text-primary">Dashboard → MCP tokens</strong>, generate a
              fresh token, and paste the whole <InlineCode>sk_mcp_…</InlineCode> string. Tokens
              are shown only once. If you lost it, generate a new one and revoke the old.
            </>
          }
        />

        <DocIssue
          title="Analysis took longer than 60 seconds"
          cause={
            <>
              Very large diffs, or the LLM provider is slow or rate-limited.
            </>
          }
          fix={
            <>
              Large PRs are capped to keep cost predictable. Splitting a huge PR into smaller
              ones both speeds up analysis and produces sharper summaries. If a normal-sized PR
              consistently times out, report it via <strong className="text-primary">Feedback</strong>.
            </>
          }
        />
      </div>
    </>
  );
}
