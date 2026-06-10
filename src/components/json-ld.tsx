import { canonicalUrl } from '@/lib/seo';

/**
 * Renders one or more schema.org JSON-LD objects as a script tag. Server
 * component — the JSON is serialized at render time. Pass a single object
 * or an array; arrays are emitted as a `@graph`-style list of scripts.
 */
export function JsonLd({ data }: { data: object | object[] }): React.ReactElement {
  const items = Array.isArray(data) ? data : [data];
  return (
    <>
      {items.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          // Schema content is static and trusted; dangerouslySetInnerHTML is
          // the documented way to emit JSON-LD in the App Router.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
    </>
  );
}

const SITE = canonicalUrl('/');

export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Senix',
  url: SITE,
  description: 'AI code review for pull requests',
  sameAs: [] as string[],
};

export const softwareApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Senix',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Web',
  description:
    'AI-powered code review that reads every PR and posts behavioral summaries with risk levels within 30 seconds',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '5',
    ratingCount: '1',
    bestRating: '5',
    worstRating: '1',
  },
  featureList: [
    'Automated PR code review',
    'Risk level detection',
    'Structural diff analysis',
    'GitHub integration',
    'MCP server for IDE integration',
    'Multiple AI providers',
  ],
};

export const webSiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Senix',
  url: SITE,
};

export const howToSchema = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to set up Senix for AI code review',
  step: [
    {
      '@type': 'HowToStep',
      name: 'Install on GitHub',
      text: 'One click from the App store. Pick the repos you want analyzed.',
    },
    {
      '@type': 'HowToStep',
      name: 'Open a pull request',
      text: 'We watch for new and updated PRs in real time.',
    },
    {
      '@type': 'HowToStep',
      name: 'Read the review',
      text: 'A 3-sentence behavioral summary, a risk level, and the exact files reviewers should focus on. Within 30 seconds.',
    },
  ],
};

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'What is Senix?',
    a: 'Senix is a GitHub App that reads every pull request your team opens and posts a behavioral summary with an overall risk level as a PR comment, usually within 30 seconds. It is built for teams shipping with AI coding tools like Cursor, Copilot, and Claude Code.',
  },
  {
    q: 'How does Senix review pull requests?',
    a: 'When a PR is opened or updated, Senix fetches the diff, builds a tree-sitter structural diff of the changed files, and asks a large language model for a concise behavioral summary, a risk level, the detected risk flags, and the specific files reviewers should focus on. The result is posted as a single PR comment that updates on re-pushes.',
  },
  {
    q: 'Which AI models does Senix use?',
    a: 'Senix uses DeepSeek as its primary provider with automatic failover across Groq, Gemini, and Anthropic. This keeps reviews flowing even if one provider is unavailable.',
  },
  {
    q: 'How is Senix different from CodeRabbit?',
    a: 'Senix focuses on a fast, behavioral summary and a clear risk level rather than line-by-line nitpicks. It highlights the exact files and risks reviewers should focus on, and it also ships an MCP server so you can run the same review from inside your IDE.',
  },
  {
    q: 'Does Senix work with Cursor and Claude Code?',
    a: 'Yes. Senix provides an MCP server, so you can connect Cursor, Claude Code, Windsurf, VS Code, Zed, JetBrains, and other MCP-compatible editors and ask the assistant to review your changes before you push.',
  },
  {
    q: 'How much does Senix cost?',
    a: 'Senix has a free plan that requires no credit card, plus paid plans for larger teams with higher monthly review limits and more connected repositories.',
  },
];

export const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
};

/** All landing-page structured data, ready to drop into the page. */
export const landingSchemas = [
  organizationSchema,
  softwareApplicationSchema,
  webSiteSchema,
  howToSchema,
  faqSchema,
];
