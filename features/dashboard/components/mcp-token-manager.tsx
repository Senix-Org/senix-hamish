'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, X } from 'lucide-react';
import { formatRelativeTime } from '@features/shared/relative-time';
import { generateMcpToken, revokeMcpToken } from '@/app/dashboard/tokens/actions';
import { TokenReveal } from '@features/dashboard/components/token-reveal';
import { useToast } from '@features/dashboard/components/toast';

export type McpTokenView = {
  id: string;
  name: string;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
};

/**
 * Format the created timestamp as an absolute date, e.g. "Nov 15, 2026".
 * A fixed locale keeps the server and client render identical so the
 * date does not trip React's hydration check.
 */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Interactive MCP token list. Active tokens are listed as cards with a
 * destructive revoke action guarded by a confirmation modal. Revoked
 * tokens are hidden behind a toggle. The "Generate token" modal asks for a
 * name first, then shows the plaintext token exactly once with a 60-second
 * copy window.
 */
export function McpTokenManager({
  tokens,
}: {
  tokens: McpTokenView[];
}): React.ReactElement {
  const [modalOpen, setModalOpen] = useState(false);
  const [showRevoked, setShowRevoked] = useState(false);

  const { active, revoked } = useMemo(() => {
    const active: McpTokenView[] = [];
    const revoked: McpTokenView[] = [];
    for (const t of tokens) (t.revokedAt ? revoked : active).push(t);
    return { active, revoked };
  }, [tokens]);

  return (
    <div>
      {active.length === 0 && revoked.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <p className="max-w-xs text-sm text-secondary">
            No tokens yet. Generate one to connect your IDE.
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-neutral-border bg-surface-raised px-3 py-2 text-sm font-medium text-primary transition-colors duration-150 hover:bg-surface-border"
          >
            <Plus size={15} strokeWidth={2.25} />
            Generate token
          </button>
        </div>
      ) : (
        <>
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-border bg-surface-raised px-3 py-2 text-sm font-medium text-primary transition-colors duration-150 hover:bg-surface-border"
            >
              <Plus size={15} strokeWidth={2.25} />
              Generate token
            </button>
          </div>

          {active.length === 0 ? (
            <p className="rounded-xl border border-surface-border bg-surface px-5 py-8 text-center text-sm text-secondary">
              No active tokens. Generate one to connect your IDE.
            </p>
          ) : (
            <div className="no-scrollbar max-h-[28rem] space-y-3 overflow-y-auto">
              {active.map((token) => (
                <TokenRow key={token.id} token={token} />
              ))}
            </div>
          )}

          {revoked.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowRevoked((v) => !v)}
                className="text-xs text-muted transition-colors duration-150 hover:text-secondary"
              >
                {showRevoked ? 'Hide revoked tokens' : `Show revoked tokens (${revoked.length})`}
              </button>
              {showRevoked && (
                <div className="no-scrollbar mt-3 max-h-[20rem] space-y-3 overflow-y-auto">
                  {revoked.map((token) => (
                    <TokenRow key={token.id} token={token} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {modalOpen && <GenerateModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}

function TokenRow({ token }: { token: McpTokenView }): React.ReactElement {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const revoked = Boolean(token.revokedAt);

  const lastUsed = token.lastUsedAt ? formatRelativeTime(new Date(token.lastUsedAt)) : 'never';

  async function onRevoke(): Promise<void> {
    setBusy(true);
    setError(null);
    const result = await revokeMcpToken(token.id);
    if (result.ok) {
      setConfirming(false);
      toast('Token revoked successfully.', 'success');
      router.refresh();
    } else {
      setError(result.error);
      toast('Something went wrong. Please try again.', 'error');
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-surface-border bg-surface p-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-primary">{token.name}</span>
          {revoked && (
            <span className="rounded-full bg-risk-high/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-risk-high">
              Revoked
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-secondary">
          <span suppressHydrationWarning>Created {formatDate(token.createdAt)}</span>
          <span className="text-muted">·</span>
          <span suppressHydrationWarning title={token.lastUsedAt ?? undefined}>
            Last used {lastUsed}
          </span>
        </div>
        {error && <div className="mt-1 text-xs text-risk-high">{error}</div>}
      </div>
      {!revoked && (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="shrink-0 rounded-lg border border-risk-high/40 px-3 py-1.5 text-xs font-medium text-risk-high transition-colors duration-150 hover:bg-risk-high/10"
        >
          Revoke
        </button>
      )}

      {confirming && (
        <RevokeConfirmModal
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={onRevoke}
        />
      )}
    </div>
  );
}

function RevokeConfirmModal({
  busy,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}): React.ReactElement {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl border border-surface-border bg-surface p-6 shadow-2xl shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-primary">Revoke this token?</h2>
        <p className="mt-3 text-sm leading-relaxed text-secondary">
          This action cannot be undone. Any IDE using this token will immediately lose access.
        </p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg px-3 py-1.5 text-sm text-secondary transition-colors hover:text-primary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-risk-high/50 bg-risk-high/10 px-3 py-1.5 text-sm font-medium text-risk-high transition-colors hover:bg-risk-high/20 disabled:cursor-wait disabled:opacity-60"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            Revoke token
          </button>
        </div>
      </div>
    </div>
  );
}

function GenerateModal({ onClose }: { onClose: () => void }): React.ReactElement {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  // The token modal cannot be dismissed until the user has copied the token
  // or the reveal window has expired — this prevents losing the secret by
  // accidentally closing too early.
  const [canClose, setCanClose] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const close = useCallback(() => {
    if (busy) return;
    // Once a token has been shown, only allow closing after copy/expiry.
    if (token && !canClose) return;
    if (token) router.refresh();
    onClose();
  }, [busy, token, canClose, router, onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    inputRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [close]);

  async function onGenerate(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await generateMcpToken(name.trim());
    if (result.ok) {
      setToken(result.token);
      toast("Token generated. Copy it now — it won't be shown again.", 'warning');
    } else {
      setError(result.error);
      toast('Something went wrong. Please try again.', 'error');
    }
    setBusy(false);
  }

  const showCloseControls = !token || canClose;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mcp-token-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="w-full max-w-md rounded-xl border border-surface-border bg-surface shadow-2xl shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-6 pb-0">
          <h2 id="mcp-token-heading" className="text-lg font-semibold text-primary">
            {token ? 'Token generated' : 'Generate MCP token'}
          </h2>
          {showCloseControls && (
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="-mr-1 -mt-1 rounded p-1 text-secondary transition-colors hover:text-primary"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {token ? (
          <div className="p-6 pt-4">
            <TokenReveal
              token={token}
              onCopied={() => {
                setCanClose(true);
                toast('Copied to clipboard.', 'neutral');
              }}
              onExpired={() => setCanClose(true)}
            />
            {error && <p className="mt-3 text-xs text-risk-high">{error}</p>}
            <div className="mt-6 flex justify-end">
              {showCloseControls ? (
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg border border-neutral-border bg-surface-raised px-4 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-surface-border"
                >
                  Done
                </button>
              ) : (
                <p className="text-xs text-muted">Copy the token to continue.</p>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={onGenerate} className="p-6 pt-4">
            <p className="text-sm text-secondary">
              Give the token a name so you can recognize it later.
            </p>
            <label className="mt-4 block">
              <span className="text-xs uppercase tracking-wider text-muted">Token name</span>
              <input
                ref={inputRef}
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 60))}
                placeholder="My Cursor setup"
                className="mt-1.5 w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm text-primary placeholder:text-muted focus:border-accent/50 focus:outline-none"
              />
            </label>
            {error && (
              <div className="mt-4 rounded-lg border border-risk-high/30 bg-risk-high/10 px-3 py-2 text-xs text-risk-high">
                {error}
              </div>
            )}
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="rounded-lg px-3 py-1.5 text-sm text-secondary transition-colors hover:text-primary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || name.trim().length < 2}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy && <Loader2 size={15} className="animate-spin" />}
                {busy ? 'Generating' : 'Generate'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
