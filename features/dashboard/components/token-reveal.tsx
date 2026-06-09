'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Eye, EyeOff, TriangleAlert } from 'lucide-react';

const REVEAL_WINDOW_SECONDS = 60;

/**
 * Shows a freshly generated MCP token with a 60-second recovery window.
 *
 * The token starts visible with a live countdown. The user can hide it and
 * re-reveal it as many times as they like within the window, which gives a
 * grace period to recover from a missed copy. When the countdown reaches
 * zero the token is wiped from memory and can never be shown again (only
 * revoked + regenerated), so the recovery window does not weaken the
 * "shown once" guarantee.
 */
export function TokenReveal({
  token,
  onCopied,
  onExpired,
}: {
  token: string;
  /** Fired the first time the token is successfully copied. */
  onCopied?: () => void;
  /** Fired when the 60-second reveal window expires. */
  onExpired?: () => void;
}): React.ReactElement {
  const [visible, setVisible] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(REVEAL_WINDOW_SECONDS);
  const [expired, setExpired] = useState(false);
  const [copied, setCopied] = useState(false);
  // Hold the secret in a ref so copy keeps working while revealed, but it is
  // cleared the instant the window expires.
  const secretRef = useRef<string | null>(token);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(id);
          secretRef.current = null;
          setExpired(true);
          setVisible(false);
          onExpired?.();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [onExpired]);

  async function onCopy(): Promise<void> {
    if (!secretRef.current) return;
    try {
      await navigator.clipboard.writeText(secretRef.current);
      setCopied(true);
      onCopied?.();
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; reveal so the user can select manually.
      setVisible(true);
    }
  }

  if (expired) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-surface-border bg-surface-raised px-3 py-2.5 text-xs text-secondary">
        <EyeOff size={15} className="mt-0.5 shrink-0 text-muted" />
        <span>
          Token hidden for security. If you didn&apos;t copy it, revoke it and generate a new one.
        </span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start gap-2 rounded-lg border border-risk-medium/30 bg-risk-medium/10 px-3 py-2.5 text-xs text-risk-medium">
        <TriangleAlert size={15} className="mt-0.5 shrink-0" />
        <span>
          Copy this now. It stays visible for {REVEAL_WINDOW_SECONDS}s, then it&apos;s gone for good.
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-surface-border bg-surface-raised px-3 py-2 font-mono text-sm text-primary">
          {visible ? token : '•'.repeat(Math.min(token.length, 40))}
        </code>
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm text-secondary transition-colors hover:text-primary"
        >
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
          {visible ? 'Hide' : 'Re-reveal'}
        </button>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-border bg-surface-raised px-3 py-2 text-sm text-secondary transition-colors hover:text-primary"
        >
          {copied ? <Check size={15} className="text-accent" /> : <Copy size={15} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <p className="mt-2 text-xs text-muted">
        Hidden in <span className="font-mono tabular-nums text-secondary">{secondsLeft}s</span>
      </p>
    </div>
  );
}
