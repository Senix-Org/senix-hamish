import { describe, it, expect, vi } from 'vitest';

/**
 * Proves the dashboard review card renders risk badges and failed-state copy
 * correctly, including the soft-failure case where the analysis row is marked
 * `completed` but the LLM/comment step produced an error and no risk level.
 * Failure means: users see misleading "unknown" badges on failed reviews.
 */

vi.mock('@features/shared/relative-time', () => ({
  formatRelativeTime: () => 'just now',
}));

import { renderToStaticMarkup } from 'react-dom/server';
import { AnalysisCard, type AnalysisCardData } from '@features/dashboard/components/analysis-card';

function baseAnalysis(overrides: Partial<AnalysisCardData> = {}): AnalysisCardData {
  return {
    id: 'a1',
    summary: 'Adds a null check.',
    risk_level: 'low',
    status: 'completed',
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    error_message: null,
    github_comment_url: null,
    pr_title: 'Fix login',
    pr_number: 7,
    repo_name: 'acme/web',
    ...overrides,
  };
}

function renderCard(overrides: Partial<AnalysisCardData> = {}): string {
  return renderToStaticMarkup(AnalysisCard({ analysis: baseAnalysis(overrides) }));
}

describe('AnalysisCard', () => {
  it('renders the risk badge for a successful review', () => {
    const html = renderCard({ risk_level: 'high', summary: 'Risky change.' });
    expect(html).toContain('high');
  });

  it('renders "Review Failed" and the error message for a soft-failure completed row', () => {
    const html = renderCard({
      risk_level: null,
      status: 'completed',
      error_message: 'LLM analysis failed: all providers unavailable',
    });
    expect(html).toContain('Review Failed');
    expect(html).toContain('LLM analysis failed: all providers unavailable');
    expect(html).toContain('N/A');
    expect(html).not.toContain('unknown');
  });

  it('renders "unknown" for a genuinely unknown risk level', () => {
    const html = renderCard({ risk_level: null, error_message: null });
    expect(html).toContain('unknown');
  });
});
