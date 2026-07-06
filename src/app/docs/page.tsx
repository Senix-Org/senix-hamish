import type { Metadata } from 'next';
import { Flag, GitPullRequest, Plug, Workflow } from 'lucide-react';
import {
  DocBadge,
  DocCallout,
  DocCard,
  DocCardGroup,
  DocH2,
  DocLink,
  DocNextLink,
  DocPageHeader,
  DocP,
  DocTable,
  DocUL,
} from '@features/shared/components/docs/doc-elements';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Docs',
  description: 'Everything you need to connect Senix to your GitHub repos and IDE.',
  path: '/docs',
});

export default function DocsIntroPage(): React.ReactElement {
  return (
    <>
      <DocPageHeader
        badge={
          <>
            <DocBadge variant="accent">Documentation</DocBadge>
            <DocBadge>GitHub App + MCP</DocBadge>
          </>
        }
        title="Welcome to Senix"
        lead={
          <>
            Senix is an AI code reviewer for teams shipping with AI tools. Every pull request
            gets a 3-sentence behavioral summary with risk levels, and your IDE can call the
            same analysis on uncommitted changes via MCP.
          </>
        }
      />

      <DocCallout title="Two ways to use Senix">
        Install the <DocLink href="/docs/installation">GitHub App</DocLink> for automatic PR
        reviews, or connect your IDE through{' '}
        <DocLink href="/docs/mcp">MCP</DocLink> for on-demand feedback before you push. Both
        surfaces share the same prompt and 8-flag risk taxonomy.
      </DocCallout>

      <DocH2>Get started</DocH2>
      <DocCardGroup cols={2}>
        <DocCard
          href="/docs/installation"
          title="Install on GitHub"
          description="Add the GitHub App and get automatic reviews on every pull request."
          icon={GitPullRequest}
        />
        <DocCard
          href="/docs/mcp"
          title="Connect to your IDE"
          description="Use Senix on uncommitted changes from Cursor, Claude Code, or Windsurf."
          icon={Plug}
        />
        <DocCard
          href="/docs/how-it-works"
          title="How it works"
          description="The analysis pipeline, structural diffs, and what the model sees."
          icon={Workflow}
        />
        <DocCard
          href="/docs/risk-flags"
          title="Risk flag reference"
          description="The 8 risk categories Senix uses on every review."
          icon={Flag}
        />
      </DocCardGroup>

      <DocH2>What every review includes</DocH2>
      <DocP>
        Whether the review lands on a pull request or in your IDE, Senix returns the same
        structured output. This keeps reviews comparable across your team.
      </DocP>
      <DocTable
        head={['Section', 'Description']}
        rows={[
          [
            <strong key="s" className="text-primary">Behavioral summary</strong>,
            'Exactly 3 sentences on what the code now does differently, not style nits.',
          ],
          [
            <strong key="r" className="text-primary">Risk level</strong>,
            'low, medium, or high, calibrated by blast radius if shipped wrong.',
          ],
          [
            <strong key="f" className="text-primary">Risk flags</strong>,
            'Up to 8 fixed tags (sql-injection, auth-change, payment-logic-change, etc.).',
          ],
          [
            <strong key="a" className="text-primary">Focus areas</strong>,
            'Up to 3 file/line ranges with a one-sentence reason to look there.',
          ],
        ]}
      />

      <DocH2>Why structural diffs matter</DocH2>
      <DocP>
        A plain text diff is noisy. A reformatted file or renamed variable looks like a big
        change but does nothing behaviorally. Senix parses each file into symbols (functions,
        classes, methods) and compares those, so the model only sees real behavioral changes.
      </DocP>
      <DocCallout variant="tip" title="Built for AI-assisted shipping">
        Senix answers a different question than line-level review bots: what behaviorally
        changed and how risky is it? Teams using Cursor, Copilot, or Claude Code get a fast
        read on blast radius without wading through hundreds of AI-generated lines.
      </DocCallout>

      <DocH2>Supported surfaces</DocH2>
      <DocUL>
        <li>
          <strong className="text-primary">GitHub pull requests</strong> — automatic on open
          and push, usually within 20–40 seconds
        </li>
        <li>
          <strong className="text-primary">IDE via MCP</strong> — on-demand when you ask your
          AI assistant to review changes
        </li>
        <li>
          <strong className="text-primary">Dashboard</strong> — history, risk filtering, and
          analysis detail for every review
        </li>
      </DocUL>

      <DocNextLink
        href="/docs/installation"
        label="Installing the GitHub App"
        description="Step-by-step setup, permissions, and how to revoke access."
      />
    </>
  );
}
