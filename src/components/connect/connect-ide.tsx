'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  KeyRound,
  RotateCw,
  TriangleAlert,
} from 'lucide-react';

/**
 * Interactive "Connect your IDE" flow.
 *
 * Starts on a 2x2 grid of supported IDEs. Selecting one swaps to a
 * three-step setup view (generate a token, copy the config, restart),
 * all driven by client state with no route change. A generated token is
 * held in state so it can be substituted into the config snippet and so
 * switching IDEs keeps the same token. The token is shown exactly once:
 * once the user leaves the page the state is gone and it cannot be
 * recovered, only revoked from the dashboard.
 */

const SERVER_URL = 'https://senix-chi.vercel.app/api/mcp';
const MAX_NAME_LEN = 60;

type IdeKey = 'cursor' | 'antigravity' | 'claude-code' | 'windsurf';

type Ide = {
  key: IdeKey;
  name: string;
  badge: string;
  /** Where the MCP config file lives for this IDE. */
  location: string;
  /** Optional docs link, used when the file location varies by platform. */
  docsUrl?: string;
};

// Grid order matches the task: Cursor, Antigravity, Claude Code, Windsurf.
const IDES: Ide[] = [
  {
    key: 'cursor',
    name: 'Cursor',
    badge: 'Cu',
    location: '~/.cursor/mcp.json on macOS or Linux, %APPDATA%\\Cursor\\mcp.json on Windows',
  },
  {
    key: 'antigravity',
    name: 'Antigravity',
    badge: 'Ag',
    location: 'The MCP config file location varies by platform. See the Antigravity docs.',
    docsUrl: 'https://antigravity.google',
  },
  {
    key: 'claude-code',
    name: 'Claude Code',
    badge: 'CC',
    location: '~/.config/claude/mcp_servers.json',
  },
  {
    key: 'windsurf',
    name: 'Windsurf',
    badge: 'Ws',
    location: '~/.codeium/windsurf/mcp_config.json',
  },
];

const TROUBLESHOOTING: string[] = [
  'Token pasted without "Bearer " in front of it.',
  'Wrong server name. The server must be called "senix" in the config.',
  'IDE was not fully quit and reopened. Some IDEs need a full restart.',
  'Another MCP server is registered with a similar tool name and is being called instead.',
  'Token was revoked or copied wrong. Generate a new one.',
];

/** Build the config snippet, substituting the token (or a placeholder). */
function buildConfig(token: string | null): string {
  return `{
  "mcpServers": {
    "senix": {
      "url": "${SERVER_URL}",
      "headers": {
        "Authorization": "Bearer ${token ?? 'YOUR_TOKEN_HERE'}"
      }
    }
  }
}`;
}

export function ConnectIde(): React.ReactElement {
  const [selected, setSelected] = useState<Ide | null>(null);
  const [token, setToken] = useState<string | null>(null);

  return (
    <div className="space-y-10">
      {selected ? (
        <SetupView
          ide={selected}
          token={token}
          onToken={setToken}
          onBack={() => setSelected(null)}
        />
      ) : (
        <IdeGrid onSelect={setSelected} />
      )}

      <div className="border-t border-zinc-800/70 pt-6">
        <Link
          href="/docs/troubleshooting"
          className="text-sm text-zinc-400 hover:text-green-400 transition-colors"
        >
          Need help?
        </Link>
      </div>

      <Troubleshooting />
    </div>
  );
}

function IdeGrid({ onSelect }: { onSelect: (ide: Ide) => void }): React.ReactElement {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {IDES.map((ide) => (
        <div
          key={ide.key}
          className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 font-mono text-sm font-semibold text-zinc-200">
              {ide.badge}
            </span>
            <span className="text-zinc-100 font-medium truncate">{ide.name}</span>
          </div>
          <button
            type="button"
            onClick={() => onSelect(ide)}
            className="shrink-0 rounded-md bg-green-500 hover:bg-green-400 px-3.5 py-1.5 text-sm font-medium text-zinc-950 transition-colors"
          >
            Select
          </button>
        </div>
      ))}
    </div>
  );
}

function SetupView({
  ide,
  token,
  onToken,
  onBack,
}: {
  ide: Ide;
  token: string | null;
  onToken: (token: string) => void;
  onBack: () => void;
}): React.ReactElement {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft size={15} />
          Choose a different IDE
        </button>
        <span className="text-zinc-600">/</span>
        <span className="text-sm text-zinc-300 font-medium">{ide.name}</span>
      </div>

      <TokenStep token={token} onToken={onToken} />
      <ConfigStep ide={ide} token={token} />
      <RestartStep />
    </div>
  );
}

function StepBox({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-zinc-950">
          {step}
        </span>
        <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function TokenStep({
  token,
  onToken,
}: {
  token: string | null;
  onToken: (token: string) => void;
}): React.ReactElement {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/mcp/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !data.token) {
        setError(data.error ?? 'Could not generate a token. Try again.');
        return;
      }
      onToken(data.token);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <StepBox step={1} title="Name and generate your token">
      {token ? (
        <div>
          <div className="flex items-start gap-2 rounded-md border border-amber-900/40 bg-amber-950/30 px-3 py-2.5 text-xs text-amber-200">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" />
            <span>
              This is the only time this token is shown. Copy it now. If you lose it, generate a
              new one.
            </span>
          </div>
          <div className="mt-3">
            <span className="text-xs uppercase tracking-wider text-zinc-500">Your token</span>
            <CopyField className="mt-1.5" value={token} mono />
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-zinc-400">
            Give the token a name so you can recognize it later. Leave it blank to use a default
            name.
          </p>
          <label className="mt-4 block">
            <span className="text-xs uppercase tracking-wider text-zinc-500">Token name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, MAX_NAME_LEN))}
              placeholder="My Cursor setup"
              className="mt-1.5 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/30"
            />
          </label>
          {error && (
            <div className="mt-3 rounded-md border border-red-900/40 bg-red-950/40 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-green-500 hover:bg-green-400 px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <KeyRound size={15} strokeWidth={2.5} />
            {busy ? 'Generating…' : 'Generate token'}
          </button>
        </div>
      )}
    </StepBox>
  );
}

function ConfigStep({ ide, token }: { ide: Ide; token: string | null }): React.ReactElement {
  const config = buildConfig(token);

  return (
    <StepBox step={2} title="Copy your config">
      {!token && (
        <p className="mb-3 text-sm text-zinc-400">
          Generate a token in step 1 first. It will be filled into the snippet below.
        </p>
      )}
      <div className="relative">
        <pre className="rounded-md border border-zinc-800 bg-zinc-950 p-4 pr-12 font-mono text-xs sm:text-sm overflow-x-auto text-zinc-300">
          {config}
        </pre>
        <div className="absolute right-2 top-2">
          <CopyButton value={config} />
        </div>
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Paste this into{' '}
        <code className="font-mono text-zinc-400">{ide.location}</code>
      </p>
      {ide.docsUrl && (
        <a
          href={ide.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-xs text-green-400 hover:text-green-300 transition-colors"
        >
          Open the Antigravity docs
          <ArrowRight size={12} />
        </a>
      )}
    </StepBox>
  );
}

function RestartStep(): React.ReactElement {
  return (
    <StepBox step={3} title="Restart your IDE and test">
      <div className="space-y-3 text-sm text-zinc-300 leading-relaxed">
        <p className="flex items-start gap-2">
          <RotateCw size={15} className="mt-0.5 shrink-0 text-zinc-500" />
          Quit your IDE completely and reopen it. Some IDEs only load MCP servers on a full
          restart.
        </p>
        <p>
          Then type this in the chat panel:{' '}
          <span className="rounded bg-zinc-950 border border-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-200">
            Use Senix to review my changes.
          </span>
        </p>
        <p className="text-zinc-400">If Senix runs and returns a review, you are connected.</p>
      </div>
    </StepBox>
  );
}

function Troubleshooting(): React.ReactElement {
  return (
    <section
      id="senix-troubleshooting"
      className="scroll-mt-20 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6"
    >
      <h2 className="text-base font-semibold text-zinc-100">Troubleshooting</h2>
      <p className="mt-1 text-sm text-zinc-400">
        If Senix does not show up in your IDE, check these common mistakes.
      </p>
      <ol className="mt-4 space-y-2.5">
        {TROUBLESHOOTING.map((item, index) => (
          <li key={item} className="flex gap-3 text-sm text-zinc-300 leading-relaxed">
            <span className="shrink-0 font-mono text-zinc-500 tabular-nums">{index + 1}.</span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** A read-only value field with a copy button beside it. */
function CopyField({
  value,
  mono,
  className,
}: {
  value: string;
  mono?: boolean;
  className?: string;
}): React.ReactElement {
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <input
        type="text"
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className={`flex-1 min-w-0 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-green-400 ${
          mono ? 'font-mono' : ''
        }`}
      />
      <CopyButton value={value} />
    </div>
  );
}

/** Stateless copy-to-clipboard button with a transient "Copied" state. */
function CopyButton({ value }: { value: string }): React.ReactElement {
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked; the field is selectable as a fallback.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 shrink-0 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800/60 transition-colors"
    >
      {copied ? <Check size={15} className="text-green-400" /> : <Copy size={15} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
