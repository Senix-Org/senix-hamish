'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, MessageSquarePlus, X } from 'lucide-react';
import { submitFeedback } from '@/app/dashboard/feedback-actions';

type Category = 'bug' | 'feature' | 'question' | 'other';

const CATEGORIES: Array<{ value: Category; label: string }> = [
  { value: 'bug', label: 'Bug report' },
  { value: 'feature', label: 'Feature request' },
  { value: 'question', label: 'Question' },
  { value: 'other', label: 'Other' },
];

const MIN_LEN = 20;
const MAX_LEN = 2000;
const AUTO_CLOSE_MS = 3000;

/**
 * Opens the feedback modal. Lives in app nav so the modal can be
 * triggered from anywhere in the dashboard.
 */
export function FeedbackTrigger(): React.ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 p-2 rounded text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
      >
        <MessageSquarePlus size={14} />
        <span>Feedback</span>
      </button>
      {open && <FeedbackModal onClose={() => setOpen(false)} />}
    </>
  );
}

function FeedbackModal({ onClose }: { onClose: () => void }): React.ReactElement {
  const [category, setCategory] = useState<Category>('bug');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const close = useCallback(() => {
    if (busy) return;
    onClose();
  }, [busy, onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    textareaRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [close]);

  useEffect(() => {
    if (!submitted) return;
    const t = window.setTimeout(onClose, AUTO_CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [submitted, onClose]);

  const trimmed = message.trim();
  const tooShort = trimmed.length < MIN_LEN;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (tooShort || busy) return;
    setBusy(true);
    setError(null);
    try {
      const pageUrl = typeof window !== 'undefined' ? window.location.href : undefined;
      const result = await submitFeedback({
        category,
        message: trimmed,
        pageUrl,
      });
      if (result.ok) {
        setSubmitted(true);
      } else {
        setError(result.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-heading"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        {submitted ? <SuccessState /> : (
          <form onSubmit={onSubmit} className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="feedback-heading" className="text-lg font-semibold text-zinc-100">
                  Send feedback
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Help us make Senix better. We read every submission.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="p-1 -mr-1 -mt-1 text-zinc-500 hover:text-zinc-200 rounded transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-xs uppercase tracking-wider text-zinc-500">Category</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  className="mt-1.5 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/30"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs uppercase tracking-wider text-zinc-500">Message</span>
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, MAX_LEN))}
                  rows={6}
                  placeholder="What's working, what's not, what would help..."
                  className="mt-1.5 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/30 resize-none"
                />
                <div className="mt-1.5 flex justify-between text-xs text-zinc-500">
                  <span>
                    {tooShort
                      ? `${MIN_LEN - trimmed.length} more character${MIN_LEN - trimmed.length === 1 ? '' : 's'} required`
                      : 'Looks good.'}
                  </span>
                  <span>
                    {trimmed.length} / {MAX_LEN}
                  </span>
                </div>
              </label>
            </div>

            {error && (
              <div className="mt-4 rounded-md border border-red-900/40 bg-red-950/40 px-3 py-2 text-xs text-red-200">
                {error}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="px-3 py-1.5 rounded-md text-sm text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={tooShort || busy}
                className="px-4 py-1.5 rounded-md bg-green-500 hover:bg-green-400 text-zinc-950 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {busy ? 'Sending…' : 'Send'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function SuccessState(): React.ReactElement {
  return (
    <div className="p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 border border-green-500/30">
        <Check size={22} className="text-green-400" strokeWidth={2.5} />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-zinc-100">Thanks — we got it.</h2>
      <p className="mt-2 text-sm text-zinc-400">
        We&apos;ll follow up via email if needed.
      </p>
    </div>
  );
}
