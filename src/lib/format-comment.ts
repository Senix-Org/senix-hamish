import type { FocusArea, ProviderName, RiskLevel } from '@/lib/llm/types';

export type FormatCommentInput = {
  summary: string;
  riskLevel: RiskLevel;
  riskFlags: string[];
  focusAreas: FocusArea[];
  provider: ProviderName;
  tokensUsed: number;
  costUsdCents: number;
  dashboardUrl: string;
};

const RISK_COLOR: Record<RiskLevel, string> = {
  low: 'brightgreen',
  medium: 'yellow',
  high: 'red',
};

/**
 * Render an analysis result as the Markdown body of a GitHub PR comment.
 *
 * Pure function: no env reads, no clock, no I/O. The caller supplies the
 * dashboard URL so this stays trivial to unit-test. Sections are omitted
 * when their data is empty, but the header and summary always render so
 * we never emit a blank comment.
 */
export function formatPRComment(input: FormatCommentInput): string {
  const sections: string[] = [renderHeader(input.riskLevel), renderSummary(input.summary)];

  if (input.riskFlags.length > 0) {
    sections.push(renderRiskFlags(input.riskFlags));
  }

  if (input.focusAreas.length > 0) {
    sections.push(renderFocusAreas(input.focusAreas));
  }

  sections.push(renderFooter(input));

  return sections.join('\n\n');
}

function renderHeader(riskLevel: RiskLevel): string {
  const color = RISK_COLOR[riskLevel];
  return `![Senix](https://img.shields.io/badge/Senix-bot-blue) ![risk](https://img.shields.io/badge/risk-${riskLevel}-${color})`;
}

function renderSummary(summary: string): string {
  return `### Behavioral summary\n\n${summary}`;
}

function renderRiskFlags(flags: string[]): string {
  const lines = flags.map((f) => `- \`${f}\``).join('\n');
  return `### Detected risks\n\n${lines}`;
}

function renderFocusAreas(areas: FocusArea[]): string {
  const header = `| File | Lines | Why |\n| --- | --- | --- |`;
  const rows = areas
    .map((a) => `| ${escapeCell(a.file)} | ${escapeCell(a.lines)} | ${escapeCell(a.reason)} |`)
    .join('\n');
  return `### Reviewer should focus on\n\n${header}\n${rows}`;
}

function renderFooter(input: FormatCommentInput): string {
  const line = `_Analyzed by Senix · ${input.provider} · ${input.tokensUsed} tokens · [View on dashboard](${input.dashboardUrl})_`;
  return `---\n\n${line}`;
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
