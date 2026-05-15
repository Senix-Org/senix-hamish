'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { formatRelativeTime } from '@/lib/relative-time';
import { GithubMark } from './github-mark';

const RISK_BADGE: Record<string, string> = {
  low: 'text-green-400 bg-green-950/40 border-green-900/50',
  medium: 'text-yellow-400 bg-yellow-950/40 border-yellow-900/50',
  high: 'text-red-400 bg-red-950/40 border-red-900/50',
};

const SUMMARY_LIMIT = 400;

export type AnalysisCardData = {
  id: string;
  summary: string | null;
  risk_level: string | null;
  created_at: string;
  github_comment_url: string | null;
  pr_title: string;
  pr_number: number | null;
  repo_name: string;
};

export function AnalysisCard({ analysis }: { analysis: AnalysisCardData }): React.ReactElement {
  const [expanded, setExpanded] = useState(true);
  const summary = analysis.summary ?? '';
  const isLong = summary.length > SUMMARY_LIMIT;
  const showCollapsed = isLong && !expanded;

  const riskBadgeClass =
    (analysis.risk_level && RISK_BADGE[analysis.risk_level]) ??
    'text-zinc-400 bg-zinc-800 border-zinc-700';

  return (
    <li className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 hover:border-zinc-700 hover:bg-zinc-900/60 transition-colors">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-mono text-zinc-400">
            <span className="truncate">{analysis.repo_name}</span>
            {analysis.pr_number !== null && (
              <span className="text-zinc-500">#{analysis.pr_number}</span>
            )}
          </div>
          <h3 className="mt-1 text-lg font-medium text-zinc-100 leading-snug">
            {analysis.pr_title}
          </h3>
        </div>
        {analysis.risk_level && (
          <span
            className={`shrink-0 text-[10px] tracking-wider rounded-full px-2.5 py-1 font-bold uppercase border ${riskBadgeClass}`}
          >
            {analysis.risk_level}
          </span>
        )}
      </div>

      {summary && (
        <div className="mt-3">
          <div className={`relative ${showCollapsed ? 'max-h-24 overflow-hidden' : ''}`}>
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">{summary}</p>
            {showCollapsed && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-zinc-900/90 to-transparent" />
            )}
          </div>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 text-xs font-medium text-green-400 hover:text-green-300 transition-colors"
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-zinc-500">
          {formatRelativeTime(new Date(analysis.created_at))}
        </span>
        <div className="flex items-center gap-2">
          {analysis.github_comment_url && (
            <a
              href={analysis.github_comment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-transparent border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs font-medium transition-colors"
            >
              <GithubMark size={13} />
              View on GitHub
            </a>
          )}
          <Link
            href={`/dashboard/analysis/${analysis.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-xs font-medium transition-colors"
          >
            Details
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </li>
  );
}
