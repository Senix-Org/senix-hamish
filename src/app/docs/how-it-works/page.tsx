import type { Metadata } from 'next';
import {
  DocH2,
  DocNextLink,
  DocP,
  DocPageHeader,
  DocTable,
  DocUL,
  InlineCode,
} from '@features/shared/components/docs/doc-elements';
import { PipelineDiagram } from '@features/shared/components/docs/pipeline-diagram';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'How Senix analyzes pull requests',
  description: 'The Senix analysis pipeline, structural diffs, and supported languages.',
  path: '/docs/how-it-works',
});

export default function HowItWorksPage(): React.ReactElement {
  return (
    <>
      <DocPageHeader
        title="How Senix analyzes pull requests"
        lead={
          <>
            Every review runs through the same pipeline: a webhook kicks it off, tree-sitter
            builds a structural diff, and the LLM turns that into a behavioral summary.
          </>
        }
      />

      <DocH2>The pipeline</DocH2>
      <PipelineDiagram />
      <DocP>
        When a PR opens or receives a new push, GitHub delivers a{' '}
        <InlineCode>pull_request</InlineCode> webhook. Senix verifies the signature, fetches
        the diff, parses each supported file, compares symbols, sends the result to the LLM,
        and posts a single comment back on the PR.
      </DocP>

      <DocH2>What is a structural diff?</DocH2>
      <DocP>
        A plain text diff tells you which lines changed. That is noisy: a reformatted file
        or a renamed variable looks like a big change but does nothing behaviorally. Senix
        parses the before and after of each file into <em>symbols</em> (functions, classes,
        methods, top-level constants) and compares those.
      </DocP>
      <DocP>
        The model sees which symbols were added, removed, or modified, with their bodies. A
        pure rename or whitespace change produces no symbol-level difference, so it never
        reaches the model as a behavioral change.
      </DocP>

      <DocH2>Supported languages</DocH2>
      <DocP>
        Structural diffing depends on a tree-sitter grammar per language. PRs touching
        unsupported file types still get a review, just without symbol-level detail.
      </DocP>
      <DocTable
        head={['Language', 'Status']}
        rows={[
          ['JavaScript', 'Supported'],
          ['TypeScript', 'Supported'],
          ['TSX', 'Supported'],
          ['Python', 'Supported'],
          ['Go', 'Coming soon'],
          ['Rust', 'Coming soon'],
        ]}
      />

      <DocH2>What we send to the LLM</DocH2>
      <DocP>The model does not receive your raw files. It receives:</DocP>
      <DocUL>
        <li>Function and method signatures of changed symbols</li>
        <li>Structural changes: which symbols were added, removed, or modified</li>
        <li>The body text of changed symbols (truncated for very large functions)</li>
        <li>PR metadata: file count, additions, deletions</li>
      </DocUL>
      <DocP>
        Unchanged symbols are skipped entirely. Files that did not change are never read.
      </DocP>

      <DocH2>Average latency</DocH2>
      <DocP>
        Most PRs complete in <strong className="text-primary">20–40 seconds</strong>{' '}
        end-to-end. Large PRs can take up to{' '}
        <strong className="text-primary">60 seconds</strong>; analysis is capped past that
        to keep cost and response time predictable.
      </DocP>

      <DocNextLink
        href="/docs/risk-flags"
        label="Risk flag reference"
        description="The 8 risk categories and example triggering code."
      />
    </>
  );
}
