import { SiteNav } from '@/components/site-nav';
import { SiteFooter } from '@/components/site-footer';

type DocSection = {
  id: string;
  label: string;
};

const SECTIONS: DocSection[] = [
  { id: 'getting-started', label: 'Getting started' },
  { id: 'how-analysis-works', label: 'How analysis works' },
  { id: 'risk-flag-reference', label: 'Risk flag reference' },
  { id: 'faq', label: 'FAQ' },
];

const RISK_FLAG_DEFS: Array<{ tag: string; def: string }> = [
  {
    tag: 'sql-injection',
    def: 'Raw user input is concatenated or interpolated into a SQL query string instead of being passed as a parameter.',
  },
  {
    tag: 'auth-change',
    def: 'Addition, removal, or modification of authentication or authorization checks (sessions, tokens, role checks, middleware guards).',
  },
  {
    tag: 'removed-validation',
    def: 'Input or schema validation that previously existed has been removed or weakened. Adding new validation does not count.',
  },
  {
    tag: 'hardcoded-secret',
    def: 'An API key, token, password, private key, or other secret is written literally in source code instead of read from env or a secret store.',
  },
  {
    tag: 'new-external-api',
    def: 'A new outbound HTTP call to a third-party service (a fetch, axios call, or SDK call to an external host).',
  },
  {
    tag: 'dependency-added',
    def: 'A new third-party package import appears that was not previously imported anywhere in the touched files.',
  },
  {
    tag: 'payment-logic-change',
    def: 'Modification to code that calculates money, prices, discounts, fees, refunds, taxes, or order totals.',
  },
  {
    tag: 'data-leak',
    def: 'A code path now exposes data to parties that should not see it (PII in a public endpoint, internal IDs leaked into logs, credentials echoed in errors).',
  },
];

/**
 * Public docs page. Two-column on desktop (sticky sidebar nav + content),
 * stacked on mobile. Anchor IDs match `SECTIONS` so deep links work.
 */
export default function DocsPage(): React.ReactElement {
  return (
    <>
      <SiteNav />
      <main className="border-b border-zinc-800/40">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-12 sm:py-16 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-12">
          <aside className="md:sticky md:top-20 self-start">
            <div className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-500 mb-4">
              Documentation
            </div>
            <nav className="flex md:flex-col gap-x-5 gap-y-2 text-sm">
              {SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="text-zinc-400 hover:text-zinc-100 transition-colors"
                >
                  {s.label}
                </a>
              ))}
            </nav>
          </aside>

          <article className="min-w-0 max-w-2xl space-y-16">
            <header>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Docs</h1>
              <p className="mt-3 text-zinc-400 leading-relaxed">
                Everything you need to install, configure, and reason about Senix.
              </p>
            </header>

            <DocBlock id="getting-started" title="Getting started">
              <p>
                Sign in with GitHub, install the <strong>Senix</strong> GitHub App on your
                organization, and pick the repos you want analyzed. There is nothing else to
                configure — Senix listens for <code>pull_request</code> events and starts
                producing reviews on the next push.
              </p>
              <ol className="list-decimal pl-5 space-y-2 marker:text-zinc-600">
                <li>Go to /login and sign in with GitHub.</li>
                <li>Click <em>Install the GitHub App</em> from the dashboard.</li>
                <li>Pick repositories. You can add more later from GitHub at any time.</li>
                <li>Open a PR. The first review appears as a comment within ~30 seconds.</li>
              </ol>
            </DocBlock>

            <DocBlock id="how-analysis-works" title="How analysis works">
              <p>
                When a PR opens or updates, Senix fetches the diff, builds a per-file{' '}
                <em>structural diff</em> using tree-sitter (added / modified / removed symbols at
                the function and class level), and asks the configured LLM provider for a typed
                analysis: a 3-sentence behavioral summary, a risk level, a list of risk flags
                from a fixed vocabulary, and up to three reviewer focus areas.
              </p>
              <p>
                The result is posted as a single GitHub comment. Subsequent pushes on the same PR
                edit that comment in place rather than spamming new ones.
              </p>
              <p>
                Provider choice is per workspace. Defaults to{' '}
                <code className="font-mono text-xs bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5">
                  deepseek
                </code>{' '}
                because it has the best structured-output reliability at low cost. Anthropic,
                Gemini, and Groq are also supported.
              </p>
            </DocBlock>

            <DocBlock id="risk-flag-reference" title="Risk flag reference">
              <p>
                Risk flags use a fixed vocabulary. The model is instructed to use only these tags
                and to omit a flag when nothing fits, rather than invent a new one.
              </p>
              <dl className="space-y-5">
                {RISK_FLAG_DEFS.map(({ tag, def }) => (
                  <div key={tag}>
                    <dt>
                      <code className="font-mono text-xs bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-green-400">
                        {tag}
                      </code>
                    </dt>
                    <dd className="mt-1.5 text-zinc-400 leading-relaxed">{def}</dd>
                  </div>
                ))}
              </dl>
            </DocBlock>

            <DocBlock id="faq" title="FAQ">
              <p>
                <strong className="text-zinc-200">Does Senix train on my code?</strong> No. PR
                contents are sent to the LLM provider you choose for the duration of one request
                and not retained for training.
              </p>
              <p>
                <strong className="text-zinc-200">What languages are supported?</strong> Today:
                JavaScript, TypeScript, TSX, and Python at the structural level. PRs touching
                other file types still get a basic LLM review without symbol-level focus.
              </p>
              <p>
                <strong className="text-zinc-200">Can I disable a noisy repo?</strong> Yes. Each
                repo has an enable / disable toggle in the dashboard. Flipping it off pauses
                analysis for that repo without uninstalling.
              </p>
            </DocBlock>
          </article>
        </div>
      </main>
      <SiteFooter />
    </>
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
