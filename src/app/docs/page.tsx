import Link from 'next/link';
import { SiteNav } from '@/components/site-nav';
import { SiteFooter } from '@/components/site-footer';
import { DocsSidebar, type DocSection } from '@/components/docs-sidebar';

const SECTIONS: DocSection[] = [
  { id: 'getting-started', label: 'Getting started' },
  { id: 'installing-the-github-app', label: 'Installing the GitHub App' },
  { id: 'how-senix-analyzes-prs', label: 'How Senix analyzes PRs' },
  { id: 'risk-flag-reference', label: 'Risk flag reference' },
  { id: 'configuration', label: 'Configuration' },
  { id: 'troubleshooting', label: 'Troubleshooting' },
  { id: 'faq', label: 'FAQ' },
  { id: 'api-reference', label: 'API reference' },
];

const RISK_FLAG_DEFS: Array<{ tag: string; def: string }> = [
  {
    tag: 'sql-injection',
    def: 'Raw user input concatenated into SQL queries.',
  },
  {
    tag: 'auth-change',
    def: 'Modification of authentication or authorization checks.',
  },
  {
    tag: 'removed-validation',
    def: 'Input or schema validation was removed.',
  },
  {
    tag: 'hardcoded-secret',
    def: 'API key, token, or password literal in source code.',
  },
  {
    tag: 'new-external-api',
    def: 'New outbound HTTP call to a third-party service.',
  },
  {
    tag: 'dependency-added',
    def: 'New third-party package import.',
  },
  {
    tag: 'payment-logic-change',
    def: 'Changes to money, prices, discounts, or fees.',
  },
  {
    tag: 'data-leak',
    def: 'Code path that exposes data to unauthorized parties.',
  },
];

/**
 * Public docs page. Two-column on desktop (sticky sidebar nav +
 * content), stacked on mobile. The sidebar highlights the section
 * currently in view via IntersectionObserver.
 */
export default function DocsPage(): React.ReactElement {
  return (
    <>
      <SiteNav />
      <main className="border-b border-zinc-800/40">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-12 sm:py-16 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-12">
          <aside className="md:sticky md:top-20 self-start">
            <div className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-500 mb-4">
              Documentation
            </div>
            <DocsSidebar sections={SECTIONS} />
          </aside>

          <article className="min-w-0 max-w-2xl space-y-16">
            <header>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Docs</h1>
              <p className="mt-3 text-zinc-400 leading-relaxed">
                Everything you need to install, configure, and reason about Senix.
              </p>
            </header>

            <GettingStarted />
            <InstallingTheGithubApp />
            <HowAnalysisWorks />
            <RiskFlagReference />
            <Configuration />
            <Troubleshooting />
            <FaqSection />
            <ApiReference />
          </article>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function GettingStarted(): React.ReactElement {
  return (
    <DocBlock id="getting-started" title="Getting started">
      <p>
        Senix is a GitHub App that reads every pull request your team opens and posts a
        behavioral summary with risk flags as a comment. No agents to configure, no rules to
        write — install it, open a PR, and the first review appears within ~30 seconds.
      </p>
      <ol className="list-decimal pl-5 space-y-2 marker:text-zinc-600">
        <li>
          Go to <Link href="/login" className="text-green-400 hover:text-green-300">/login</Link> and sign in with GitHub.
        </li>
        <li>Click <strong>Install GitHub App</strong> from the dashboard and pick repositories.</li>
        <li>Open a PR. The comment appears once analysis completes.</li>
      </ol>
      <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/60 aspect-[16/9] grid place-items-center">
        <span className="text-xs text-zinc-500 font-mono">Quickstart screenshot</span>
      </div>
    </DocBlock>
  );
}

function InstallingTheGithubApp(): React.ReactElement {
  return (
    <DocBlock id="installing-the-github-app" title="Installing the GitHub App">
      <p>
        The install is one click from your dashboard. Senix-bot will appear in the
        installation list under your GitHub settings once authorized.
      </p>
      <ol className="list-decimal pl-5 space-y-2 marker:text-zinc-600">
        <li>Sign in to <InlineLink href="/login">Senix</InlineLink>.</li>
        <li>From the dashboard, click <strong>Install GitHub App</strong>.</li>
        <li>Choose the user or organization to install on.</li>
        <li>Select repositories — either all repositories or a specific subset.</li>
        <li>Authorize and you&apos;ll be redirected back to your dashboard.</li>
      </ol>
      <p>
        <strong>Org installs require admin permission.</strong> If you&apos;re not an owner
        on your GitHub organization, you may need to request the install via the GitHub
        approval flow.
      </p>
      <h3 className="text-base font-semibold text-zinc-100 mt-6">Permissions Senix requests</h3>
      <ul className="list-disc pl-5 space-y-1.5 marker:text-zinc-600">
        <li>
          <strong>Read access</strong> to code, pull requests, and metadata — so we can fetch
          the diff to analyze it.
        </li>
        <li>
          <strong>Write access</strong> to pull request comments — so we can post and update
          the review comment in place.
        </li>
      </ul>
      <p>
        Senix never writes to your code, never opens PRs, and never approves or requests
        changes. The only write surface is the bot comment on the PR being analyzed.
      </p>
      <h3 className="text-base font-semibold text-zinc-100 mt-6">Uninstalling</h3>
      <p>
        Visit <InlineCode>github.com/settings/installations</InlineCode> (or the
        organization equivalent), find <strong>Senix-bot</strong>, and click{' '}
        <strong>Uninstall</strong>. We soft-delete your installation so reinstalling later
        restores your history.
      </p>
    </DocBlock>
  );
}

function HowAnalysisWorks(): React.ReactElement {
  return (
    <DocBlock id="how-senix-analyzes-prs" title="How Senix analyzes PRs">
      <p>
        When a PR opens or receives a new push, GitHub delivers a{' '}
        <InlineCode>pull_request</InlineCode> webhook to Senix. From there:
      </p>
      <ol className="list-decimal pl-5 space-y-2 marker:text-zinc-600">
        <li>
          <strong>Webhook</strong> — we verify the signature, dedupe by delivery id, and
          upsert PR metadata.
        </li>
        <li>
          <strong>Structural diff</strong> — we fetch the PR diff and parse each supported
          file with tree-sitter into <em>symbols</em> (functions, classes, imports), then
          compare the before/after symbol tables. The model sees added/modified/removed
          symbols, not just text lines.
        </li>
        <li>
          <strong>LLM analysis</strong> — the structural diff is sent to the configured
          provider with a typed-output prompt. We get back a 3-sentence behavioral summary,
          a risk level, a list of risk flags, and reviewer focus areas.
        </li>
        <li>
          <strong>Comment</strong> — the result is posted as a single bot comment on the PR.
          Subsequent pushes update the existing comment in place rather than posting a new
          one.
        </li>
      </ol>
      <h3 className="text-base font-semibold text-zinc-100 mt-6">Supported languages</h3>
      <p>
        Structural diffing currently covers <InlineCode>JavaScript</InlineCode>,{' '}
        <InlineCode>TypeScript</InlineCode>, <InlineCode>TSX</InlineCode>, and{' '}
        <InlineCode>Python</InlineCode>. PRs touching other file types still get a basic LLM
        review against the raw diff.
      </p>
      <h3 className="text-base font-semibold text-zinc-100 mt-6">Latency</h3>
      <p>
        Most PRs complete in <strong>20-40 seconds</strong> end-to-end. Very large diffs
        (hundreds of files) can take longer; we cap analysis to keep cost predictable.
      </p>
    </DocBlock>
  );
}

function RiskFlagReference(): React.ReactElement {
  return (
    <DocBlock id="risk-flag-reference" title="Risk flag reference">
      <p>
        Risk flags use a fixed vocabulary. The model is instructed to use only these tags
        and to omit a flag when nothing fits, rather than invent a new one.
      </p>
      <div className="not-prose overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/60 text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium text-zinc-400 border-b border-zinc-800 w-[40%]">
                Flag
              </th>
              <th className="px-4 py-2.5 font-medium text-zinc-400 border-b border-zinc-800">
                Meaning
              </th>
            </tr>
          </thead>
          <tbody>
            {RISK_FLAG_DEFS.map(({ tag, def }, i) => (
              <tr
                key={tag}
                className={i % 2 === 0 ? 'bg-zinc-950' : 'bg-zinc-900/30'}
              >
                <td className="px-4 py-3 align-top">
                  <code className="font-mono text-xs bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-green-400">
                    {tag}
                  </code>
                </td>
                <td className="px-4 py-3 text-zinc-300 align-top">{def}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-zinc-500">
        Risk flag names are stable. We won&apos;t rename them without a deprecation period.
      </p>
    </DocBlock>
  );
}

function Configuration(): React.ReactElement {
  return (
    <DocBlock id="configuration" title="Configuration">
      <h3 className="text-base font-semibold text-zinc-100">Enable or disable a repo</h3>
      <p>
        Every repo has a toggle on your dashboard. Flipping it off pauses analysis for that
        repo without uninstalling the GitHub App — useful for noisy fixtures or generated
        code repos.
      </p>
      <h3 className="text-base font-semibold text-zinc-100 mt-6">Uninstall the GitHub App</h3>
      <p>
        See <InlineLink href="#installing-the-github-app">Installing the GitHub App</InlineLink>{' '}
        above. Uninstalling pauses everything; your history stays intact in case you reinstall.
      </p>
      <h3 className="text-base font-semibold text-zinc-100 mt-6">Risk thresholds</h3>
      <p className="text-zinc-500">Coming soon. The default thresholds work for most teams.</p>
    </DocBlock>
  );
}

function Troubleshooting(): React.ReactElement {
  return (
    <DocBlock id="troubleshooting" title="Troubleshooting">
      <h3 className="text-base font-semibold text-zinc-100">My PR didn&apos;t get a comment</h3>
      <p>Possible causes, in order of frequency:</p>
      <ul className="list-disc pl-5 space-y-1.5 marker:text-zinc-600">
        <li>The repo is <strong>disabled</strong> on your dashboard.</li>
        <li>
          Webhook delivery failed. Open the installation at{' '}
          <InlineCode>github.com/settings/installations</InlineCode> and check{' '}
          <strong>Recent Deliveries</strong>.
        </li>
        <li>
          The PR only touches unsupported file types. Structural analysis runs on JS, TS,
          TSX, and Python — PRs with none of those still get a basic review.
        </li>
      </ul>
      <h3 className="text-base font-semibold text-zinc-100 mt-6">I got the wrong risk level</h3>
      <p>
        The prompt is calibrated against our internal eval set (94% accuracy as of v2).
        Calibration drift is real and we welcome examples — use the{' '}
        <strong>Feedback</strong> button in the dashboard with the PR URL and we&apos;ll
        use it for the next eval run.
      </p>
      <h3 className="text-base font-semibold text-zinc-100 mt-6">
        The bot comment didn&apos;t update on my new push
      </h3>
      <p>
        Senix <strong>updates</strong> the existing comment rather than posting a new one,
        so the GitHub UI may not bubble it to the top. Refresh the PR page to see the
        latest analysis.
      </p>
      <h3 className="text-base font-semibold text-zinc-100 mt-6">I deleted the bot comment</h3>
      <p>
        No problem. Senix will post a fresh comment on the next push to the PR.
      </p>
    </DocBlock>
  );
}

function FaqSection(): React.ReactElement {
  return (
    <DocBlock id="faq" title="FAQ">
      <FaqItem question="Is Senix free?">
        Yes, during public beta. Paid plans are coming once the API surface stabilizes.
      </FaqItem>
      <FaqItem question="Does Senix store my code?">
        No. We store the structural-diff metadata (added/modified/removed symbols, file
        names, line ranges) but not raw source. The full diff is sent to the LLM provider
        for a single request and not retained.
      </FaqItem>
      <FaqItem question="Can I self-host Senix?">
        Not currently. If self-hosting is a blocker for you, reach out via the{' '}
        <strong>Feedback</strong> button in the dashboard.
      </FaqItem>
      <FaqItem question="What LLM does Senix use?">
        DeepSeek is the default analysis provider — it has the best structured-output
        reliability at low cost. Anthropic Claude is used for some operations.
      </FaqItem>
      <FaqItem question="How accurate is it?">
        The current v2 prompt scores <strong>94%</strong> on our internal eval set. We
        publish accuracy with each prompt revision and revert on regressions.
      </FaqItem>
    </DocBlock>
  );
}

function ApiReference(): React.ReactElement {
  return (
    <DocBlock id="api-reference" title="API reference">
      <p className="text-zinc-500">
        Coming soon. The Senix API will let you fetch analyses, subscribe to PR events, and
        integrate analysis directly into your tools. If a specific endpoint would unblock
        you, ping us via the Feedback form.
      </p>
    </DocBlock>
  );
}

function DocBlock({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-2xl font-semibold tracking-tight text-zinc-100 mb-5">{title}</h2>
      <div className="space-y-4 text-[15px] text-zinc-300 leading-relaxed [&_strong]:text-zinc-100">
        {children}
      </div>
    </section>
  );
}

function FaqItem({
  question,
  children,
}: {
  question: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
      <p className="font-semibold text-zinc-100">{question}</p>
      <div className="mt-2 text-zinc-400">{children}</div>
    </div>
  );
}

function InlineCode({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <code className="bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-sm font-mono">
      {children}
    </code>
  );
}

function InlineLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Link href={href} className="text-green-400 hover:text-green-300 transition-colors">
      {children}
    </Link>
  );
}
