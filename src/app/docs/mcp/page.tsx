import type { Metadata } from 'next';
import { Terminal } from 'lucide-react';
import {
  DocBadge,
  DocCallout,
  DocCard,
  DocCardGroup,
  DocCompareCards,
  DocH2,
  DocH3,
  DocLink,
  DocNextLink,
  DocOL,
  DocP,
  DocPageHeader,
  DocUL,
  CodeBlock,
  InlineCode,
} from '@features/shared/components/docs/doc-elements';
import {
  claudeCodeCliCommand,
  claudeCodeConfigJson,
  cursorConfigJson,
  getMcpServerUrl,
  windsurfConfigJson,
} from '@features/shared/mcp-config';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'MCP integration for IDEs',
  description: 'Connect Senix to Cursor, Claude Code, Windsurf, and other MCP-compatible IDEs.',
  path: '/docs/mcp',
});

export default function McpDocsPage(): React.ReactElement {
  const serverUrl = getMcpServerUrl();
  const cursorConfig = cursorConfigJson(null, serverUrl);
  const claudeCodeConfig = claudeCodeConfigJson(null, serverUrl);
  const claudeCodeCli = claudeCodeCliCommand(null, serverUrl);
  const windsurfConfig = windsurfConfigJson(null, serverUrl);

  return (
    <>
      <DocPageHeader
        badge={<DocBadge variant="accent">MCP</DocBadge>}
        title="MCP integration for IDEs"
        lead={
          <>
            Senix integrates with any MCP-compatible IDE. Use it in Cursor, Claude Code,
            Windsurf, and others to review uncommitted changes before you push.
          </>
        }
      />

      <DocCallout title="Fastest setup">
        Use <DocLink href="/dashboard/connect">Dashboard → Connect IDE</DocLink>. It generates
        a token, provides a one-click <strong className="text-primary">Add to Cursor</strong>{' '}
        button (or a copyable <InlineCode>claude mcp add</InlineCode> command for Claude Code),
        and a live <strong className="text-primary">Test connection</strong> button. The steps
        below are the manual equivalent.
      </DocCallout>

      <DocH2>Supported IDEs</DocH2>
      <DocCardGroup cols={3}>
        <DocCard
          href="#cursor"
          title="Cursor"
          description="One-click install or ~/.cursor/mcp.json"
          icon={Terminal}
        />
        <DocCard
          href="#claude-code"
          title="Claude Code"
          description="CLI command or .mcp.json config"
          icon={Terminal}
        />
        <DocCard
          href="#windsurf"
          title="Windsurf"
          description="mcp_config.json in Codeium folder"
          icon={Terminal}
        />
      </DocCardGroup>

      <DocH2>What is MCP?</DocH2>
      <DocP>
        The Model Context Protocol (MCP) is an open standard for AI tools to communicate with
        external services. IDEs that support MCP can connect to a server like Senix and expose
        its tools to your AI assistant. When you ask your IDE&apos;s AI to review your changes,
        it calls the Senix tool, sends the diff, and gets back our analysis. No pull request
        required.
      </DocP>

      <DocH2>Manual setup</DocH2>
      <DocOL>
        <li>
          Go to <strong className="text-primary">Dashboard → MCP tokens</strong> and click{' '}
          <strong className="text-primary">Generate token</strong>.
        </li>
        <li>Copy the token. It is shown once (with a 60-second recovery window).</li>
        <li>
          Add it to your IDE using the per-IDE instructions below, replacing{' '}
          <InlineCode>YOUR_TOKEN_HERE</InlineCode> with the copied token.
        </li>
      </DocOL>

      <DocH3 id="cursor">Cursor</DocH3>
      <DocP>
        Use the one-click <strong className="text-primary">Add to Cursor</strong> button on the{' '}
        <DocLink href="/dashboard/connect">Connect IDE</DocLink> page, or add this to your{' '}
        <InlineCode>~/.cursor/mcp.json</InlineCode> (global) or{' '}
        <InlineCode>.cursor/mcp.json</InlineCode> (per project).
      </DocP>
      <CodeBlock label="mcp.json">{cursorConfig}</CodeBlock>

      <DocH3 id="claude-code">Claude Code</DocH3>
      <DocP>Run this in your terminal, then restart Claude Code:</DocP>
      <CodeBlock label="terminal">{claudeCodeCli}</CodeBlock>
      <DocP>
        Or add it to your <InlineCode>.mcp.json</InlineCode> manually:
      </DocP>
      <CodeBlock label=".mcp.json">{claudeCodeConfig}</CodeBlock>

      <DocH3 id="windsurf">Windsurf</DocH3>
      <DocP>
        Add the following to your Windsurf MCP config at{' '}
        <InlineCode>~/.codeium/windsurf/mcp_config.json</InlineCode>.
      </DocP>
      <CodeBlock label="mcp_config.json">{windsurfConfig}</CodeBlock>

      <DocH2>How to use it in your IDE</DocH2>
      <DocP>Once connected, ask your IDE&apos;s AI in plain language:</DocP>
      <DocUL>
        <li>&quot;Review my changes with Senix&quot;</li>
        <li>&quot;Check this code for risks&quot;</li>
      </DocUL>
      <DocP>
        The AI calls Senix&apos;s <InlineCode>review_changes</InlineCode> tool with your
        before/after file contents. You&apos;ll see the behavioral summary, risk level, and
        focus areas right in your chat panel.
      </DocP>

      <DocH2>GitHub bot vs MCP</DocH2>
      <DocCompareCards
        left={{
          title: 'GitHub App',
          children: (
            <ul className="space-y-2">
              <li>Runs automatically on PR open and push</li>
              <li>Works on committed changes in a pull request</li>
              <li>Posts a comment on the PR thread</li>
            </ul>
          ),
        }}
        right={{
          title: 'MCP in your IDE',
          children: (
            <ul className="space-y-2">
              <li>Runs on demand when you ask</li>
              <li>Works on uncommitted editor changes</li>
              <li>Returns results in your chat panel</li>
            </ul>
          ),
        }}
      />
      <DocP>
        Both use the same prompt and 8-flag risk taxonomy, so the analysis stays consistent.
        See <DocLink href="/docs/configuration">Configuration</DocLink> for managing MCP
        tokens.
      </DocP>

      <DocNextLink
        href="/docs/configuration"
        label="Configuration"
        description="Manage repos, MCP tokens, and uninstalling Senix."
      />
    </>
  );
}
