import type { Metadata } from 'next';
import { PLAN_LIMITS } from '@features/billing/plan-limits';
import {
  DocFaqItem,
  DocLink,
  DocPageHeader,
} from '@features/shared/components/docs/doc-elements';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Frequently asked questions',
  description: 'Answers to common questions about Senix — pricing, privacy, accuracy, and more.',
  path: '/docs/faq',
});

export default function FaqPage(): React.ReactElement {
  return (
    <>
      <DocPageHeader
        title="Frequently asked questions"
        lead="Short answers to the questions we hear most."
      />

      <div className="mt-8 space-y-3">
        <DocFaqItem question="Is Senix free?">
          Yes. Senix has a permanent Free plan for {PLAN_LIMITS.free.repos} repo and{' '}
          {PLAN_LIMITS.free.tokens.toLocaleString()} tokens per month. Starter, Team, and Pro
          are paid monthly plans. See the <DocLink href="/pricing">pricing page</DocLink> for
          details.
        </DocFaqItem>

        <DocFaqItem question="Does Senix store my code?">
          No. We persist the structural-diff metadata (added, modified, and removed symbols
          with file names and line ranges) and the generated summary. We do not persist your
          raw source files.
        </DocFaqItem>

        <DocFaqItem question="What data does Senix collect?">
          PR metadata (title, author, file counts), the structural diff, and the analysis
          result. The diff content is sent to the LLM provider for a single request and not
          retained for training. Account data covers your GitHub identity and installation
          settings.
        </DocFaqItem>

        <DocFaqItem question="Can I self-host Senix?">
          Not today. The pipeline is open source if you want to read or fork it, but the hosted
          product is the supported path. Reach out via the Feedback button if you have a hard
          self-host requirement.
        </DocFaqItem>

        <DocFaqItem question="What LLM does Senix use?">
          DeepSeek is the primary provider in production for reliable structured output at low
          cost. Anthropic, Gemini, and Groq are also supported. The active provider is set via{' '}
          <code className="rounded border border-surface-border bg-surface-raised px-1.5 py-0.5 font-mono text-xs text-accent-hover">
            LLM_PROVIDER
          </code>
          .
        </DocFaqItem>

        <DocFaqItem question="How accurate is Senix?">
          The current prompt scores 94% on our internal eval set. We publish accuracy with each
          prompt revision and revert on regressions. Calibration drift is real — send us
          examples that look wrong and we fold them into the next eval run.
        </DocFaqItem>

        <DocFaqItem question="How does Senix differ from GitHub Copilot's review feature?">
          Copilot&apos;s review suggests line-level edits. Senix answers a different question:
          what behaviorally changed and how risky is it, in a 3-sentence summary with a fixed
          risk taxonomy. It is built for teams shipping AI-generated code who need a fast read
          on blast radius, not a list of nits.
        </DocFaqItem>

        <DocFaqItem question="Can I customize the risk flags?">
          Not yet. The 8-flag taxonomy is fixed today so the analysis stays consistent and
          comparable across PRs. Custom risk-flag configuration is planned for the Pro tier.
        </DocFaqItem>

        <DocFaqItem question="Is there an API?">
          Not yet. It&apos;s on the roadmap. See the{' '}
          <DocLink href="/docs/api">API reference</DocLink> for what we&apos;re planning.
        </DocFaqItem>
      </div>
    </>
  );
}
