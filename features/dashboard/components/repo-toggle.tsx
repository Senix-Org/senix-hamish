'use client';

import { useState, useTransition } from 'react';
import { toggleRepoEnabled } from '@/app/dashboard/actions';
import { useToast } from '@features/dashboard/components/toast';

type Props = {
  repoId: string;
  enabled: boolean;
};

/**
 * Optimistic enable/disable toggle for a single repo. Calls the server
 * action which flips `repositories.enabled` after verifying ownership,
 * then revalidates the dashboard.
 */
export default function RepoToggle({ repoId, enabled }: Props): React.ReactElement {
  const [optimistic, setOptimistic] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function onToggle(): void {
    const next = !optimistic;
    setOptimistic(next);
    setError(null);
    startTransition(async () => {
      const result = await toggleRepoEnabled(repoId);
      if (!result.ok) {
        setOptimistic(!next);
        setError(result.error);
        toast(result.error || 'Something went wrong. Please try again.', 'error');
      } else {
        setOptimistic(result.enabled);
        toast(
          result.enabled ? 'Repository connected.' : 'Repository disconnected.',
          'success'
        );
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onToggle}
        disabled={isPending}
        aria-pressed={optimistic}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-base ${
          optimistic ? 'bg-accent' : 'bg-surface-raised hover:bg-surface-border'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
            optimistic ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      {error && <span className="text-red-400 text-xs">{error}</span>}
    </div>
  );
}
