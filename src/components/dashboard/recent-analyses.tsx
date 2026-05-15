'use client';

import { useMemo, useState } from 'react';
import { RevealItem, RevealStagger } from '@/components/reveal';
import { AnalysisCard, type AnalysisCardData } from './analysis-card';

const RISK_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

type RiskFilter = 'all' | 'high' | 'medium' | 'low';
type SortOrder = 'newest' | 'oldest' | 'risk';

export function RecentAnalyses({
  analyses,
}: {
  analyses: AnalysisCardData[];
}): React.ReactElement {
  const [risk, setRisk] = useState<RiskFilter>('all');
  const [sort, setSort] = useState<SortOrder>('newest');

  const visible = useMemo(() => {
    const filtered =
      risk === 'all' ? analyses : analyses.filter((a) => a.risk_level === risk);

    const sorted = [...filtered];
    if (sort === 'newest') {
      sorted.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } else if (sort === 'oldest') {
      sorted.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    } else {
      sorted.sort((a, b) => {
        const ra = a.risk_level ? RISK_RANK[a.risk_level] ?? 0 : 0;
        const rb = b.risk_level ? RISK_RANK[b.risk_level] ?? 0 : 0;
        if (rb !== ra) return rb - ra;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
    return sorted;
  }, [analyses, risk, sort]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterSelect
          label="Risk"
          value={risk}
          onChange={(v) => setRisk(v as RiskFilter)}
          options={[
            { value: 'all', label: 'All' },
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' },
            { value: 'low', label: 'Low' },
          ]}
        />
        <FilterSelect
          label="Sort"
          value={sort}
          onChange={(v) => setSort(v as SortOrder)}
          options={[
            { value: 'newest', label: 'Newest first' },
            { value: 'oldest', label: 'Oldest first' },
            { value: 'risk', label: 'Highest risk first' },
          ]}
        />
        <span className="ml-auto text-xs text-zinc-500 tabular-nums">
          {visible.length} of {analyses.length}
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 text-zinc-400 text-sm">
          No analyses match this filter.
        </div>
      ) : (
        <RevealStagger className="space-y-3" staggerMs={40}>
          {visible.map((a) => (
            <RevealItem key={a.id}>
              <AnalysisCard analysis={a} />
            </RevealItem>
          ))}
        </RevealStagger>
      )}
    </div>
  );
}

type SelectOption = { value: string; label: string };

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: SelectOption[];
}): React.ReactElement {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-zinc-400">
      <span className="text-zinc-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-200 text-xs rounded-md px-2 py-1.5 focus:outline-none focus:border-zinc-600 transition-colors cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-zinc-900">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
