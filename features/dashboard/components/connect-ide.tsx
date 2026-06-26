'use client';

import { useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Copy,
  ExternalLink,
  Loader2,
  RotateCw,
  Terminal,
  TriangleAlert,
} from 'lucide-react';
import { TokenReveal } from '@features/dashboard/components/token-reveal';
import { useToast } from '@features/dashboard/components/toast';
import {
  claudeCodeCliCommand,
  claudeCodeConfigJson,
  claudeDesktopConfigJson,
  cursorConfigJson,
  cursorDeepLink,
  genericConfigJson,
  getMcpServerUrl,
  jetbrainsConfigJson,
  vscodeConfigJson,
  windsurfConfigJson,
  zedConfigJson,
} from '@features/shared/mcp-config';

/**
 * Interactive "Connect your IDE" flow, tuned for zero friction.
 *
 * Pick an IDE, generate a token (with a 60s recovery window), then install
 * with one click where the tool supports it: a Cursor deep link, the
 * `claude mcp add` CLI for Claude Code, and a one-click config copy for
 * Windsurf / others. Step 3 verifies the connection live against
 * /api/mcp/test. All snippets come from the shared mcp-config module, so
 * they match the docs exactly and carry the real token.
 */

const MAX_NAME_LEN = 60;

type IdeKey =
  | 'cursor'
  | 'claude-code'
  | 'windsurf'
  | 'vscode'
  | 'zed'
  | 'claude-desktop'
  | 'jetbrains'
  | 'antigravity'
  | 'other';

type Ide = {
  key: IdeKey;
  name: string;
  badge: string;
  location: string;
  docsUrl?: string;
};

const IDES: Ide[] = [
  {
    key: 'cursor',
    name: 'Cursor',
    badge: 'Cu',
    location: '~/.cursor/mcp.json on macOS or Linux, %APPDATA%\\Cursor\\mcp.json on Windows',
  },
  {
    key: 'claude-code',
    name: 'Claude Code',
    badge: 'CC',
    location: 'Adds an entry to your Claude Code MCP config automatically.',
  },
  {
    key: 'windsurf',
    name: 'Windsurf',
    badge: 'Ws',
    location: '~/.codeium/windsurf/mcp_config.json',
  },
  {
    key: 'vscode',
    name: 'VS Code (Copilot)',
    badge: 'VS',
    location: '.vscode/mcp.json in your workspace, or your user settings.json under "mcp".',
  },
  {
    key: 'zed',
    name: 'Zed',
    badge: 'Zd',
    location: 'Zed settings.json (Cmd/Ctrl+, then "Open Settings").',
  },
  {
    key: 'claude-desktop',
    name: 'Claude Desktop',
    badge: 'CD',
    location:
      '~/Library/Application Support/Claude/claude_desktop_config.json on macOS, %APPDATA%\\Claude\\claude_desktop_config.json on Windows. Requires Node.js for the mcp-remote bridge.',
  },
  {
    key: 'jetbrains',
    name: 'JetBrains',
    badge: 'JB',
    location: 'Settings → Tools → AI Assistant → Model Context Protocol (MCP).',
  },
  {
    key: 'antigravity',
    name: 'Antigravity',
    badge: 'Ag',
    location: 'The MCP config file location varies by platform. See the Antigravity docs.',
    docsUrl: 'https://antigravity.google',
  },
  {
    key: 'other',
    name: 'Other IDE',
    badge: '··',
    location: 'Any MCP-compatible client that accepts an HTTP server URL and headers.',
  },
];

export function ConnectIde(): React.ReactElement {
  const [selected, setSelected] = useState<Ide | null>(null);
  const [token, setToken] = useState<string | null>(null);

  if (selected) {
    return (
      <SetupView
        key={selected.key}
        ide={selected}
        token={token}
        onToken={setToken}
        onBack={() => setSelected(null)}
      />
    );
  }

  return <IdeGrid onSelect={setSelected} />;
}

function IdeGrid({ onSelect }: { onSelect: (ide: Ide) => void }): React.ReactElement {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {IDES.map((ide) => (
        <button
          key={ide.key}
          type="button"
          onClick={() => onSelect(ide)}
          className="group flex cursor-pointer items-center gap-4 rounded-xl border border-surface-border bg-surface p-6 text-left transition-all duration-150 hover:border-neutral-border hover:bg-surface-raised"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-raised font-mono text-sm font-bold text-primary">
            {ide.badge}
          </span>
          <span className="flex-1 truncate text-[15px] font-medium text-primary">{ide.name}</span>
          <span className="shrink-0 rounded-lg border border-surface-border bg-surface-raised px-3 py-1.5 text-sm text-primary transition-colors duration-150 group-hover:border-neutral-border">
            Select
          </span>
        </button>
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
    <div className="animate-fade-up space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-secondary transition-colors duration-150 hover:text-primary"
        >
          <ChevronLeft size={15} />
          Choose a different IDE
        </button>
        <span className="text-muted">/</span>
        <span className="text-primary">{ide.name}</span>
      </div>

      <TokenStep token={token} onToken={onToken} />
      <InstallStep ide={ide} token={token} />
      <TestStep token={token} />

      <a
        href="/docs/mcp"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-secondary transition-colors duration-150 hover:text-primary"
      >
        Need help?
        <ExternalLink size={14} />
      </a>
    </div>
  );
}

function StepCircle({ step, done }: { step: number; done: boolean }): React.ReactElement {
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-sm transition-colors duration-300 ease-out ${
        done ? 'border-accent text-accent' : 'border-surface-border text-secondary'
      }`}
    >
      {done ? <Check size={15} strokeWidth={2.5} /> : step}
    </span>
  );
}

function StepBox({
  step,
  title,
  done = false,
  children,
}: {
  step: number;
  title: string;
  done?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="rounded-xl border border-surface-border bg-surface p-6">
      <div className="mb-4 flex items-center gap-3">
        <StepCircle step={step} done={done} />
        <h2 className="text-[15px] font-semibold text-primary">{title}</h2>
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
  const { toast } = useToast();

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
        toast('Something went wrong. Please try again.', 'error');
        return;
      }
      onToken(data.token);
      toast("Token generated. Copy it now — it won't be shown again.", 'warning');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
      toast('Something went wrong. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <StepBox step={1} title="Name and generate your token" done={Boolean(token)}>
      {token ? (
        <TokenReveal token={token} />
      ) : (
        <div>
          <p className="text-sm leading-relaxed text-secondary">
            Give the token a name so you can recognize it later. Leave it blank to use a default
            name.
          </p>
          <label className="mt-4 block">
            <span className="text-xs uppercase tracking-wider text-muted">Token name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, MAX_NAME_LEN))}
              placeholder="My Cursor setup"
              className="mt-1.5 w-full rounded-lg border border-surface-border bg-surface-raised p-3 text-sm text-primary placeholder:text-muted focus:border-accent/50 focus:outline-none"
            />
          </label>
          {error && (
            <div className="mt-3 rounded-lg border border-risk-high/30 bg-risk-high/10 px-3 py-2 text-xs text-risk-high">
              {error}
            </div>
          )}
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="btn-senix btn-senix-primary mt-4 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Generating' : 'Generate token'}
          </button>
        </div>
      )}
    </StepBox>
  );
}

function InstallStep({ ide, token }: { ide: Ide; token: string | null }): React.ReactElement {
  return (
    <StepBox step={2} title="Install Senix">
      {!token && (
        <p className="mb-3 text-sm leading-relaxed text-secondary">
          Generate a token in step 1 first. It is filled into the install action below.
        </p>
      )}
      {ide.key === 'cursor' && <CursorInstall token={token} location={ide.location} />}
      {ide.key === 'claude-code' && <ClaudeCodeInstall token={token} />}
      {ide.key === 'windsurf' && (
        <ConfigInstall config={windsurfConfigJson(token)} location={ide.location} />
      )}
      {ide.key === 'vscode' && (
        <ConfigInstall config={vscodeConfigJson(token)} location={ide.location} />
      )}
      {ide.key === 'zed' && (
        <ConfigInstall config={zedConfigJson(token)} location={ide.location} />
      )}
      {ide.key === 'claude-desktop' && (
        <ConfigInstall config={claudeDesktopConfigJson(token)} location={ide.location} />
      )}
      {ide.key === 'jetbrains' && (
        <ConfigInstall config={jetbrainsConfigJson(token)} location={ide.location} />
      )}
      {ide.key === 'antigravity' && (
        <ConfigInstall config={genericConfigJson(token)} location={ide.location} docsUrl={ide.docsUrl} />
      )}
      {ide.key === 'other' && <OtherInstall token={token} />}
    </StepBox>
  );
}

function OtherInstall({ token }: { token: string | null }): React.ReactElement {
  return (
    <div>
      <p className="text-sm leading-relaxed text-secondary">
        Paste this URL and header into your IDE&apos;s MCP settings. Most clients accept either
        the raw endpoint and header below, or the JSON config beneath it.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <div className="mb-1.5 text-xs uppercase tracking-wider text-muted">Server URL</div>
          <CopyField value={getMcpServerUrl()} />
        </div>
        <div>
          <div className="mb-1.5 text-xs uppercase tracking-wider text-muted">
            Authorization header
          </div>
          <CopyField value={`Authorization: Bearer ${token ?? 'YOUR_TOKEN_HERE'}`} />
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 text-xs uppercase tracking-wider text-muted">Or JSON config</div>
        <ConfigBlock config={genericConfigJson(token)} />
      </div>
    </div>
  );
}

function CopyField({ value }: { value: string }): React.ReactElement {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-surface-raised p-3 pr-12 font-mono text-xs leading-relaxed text-secondary">
        {value}
      </pre>
      <div className="absolute right-2 top-1.5">
        <CopyButton value={value} iconOnly />
      </div>
    </div>
  );
}

function CursorInstall({
  token,
  location,
}: {
  token: string | null;
  location: string;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <p className="text-sm leading-relaxed text-secondary">
        One click — opens Cursor and installs Senix with your token already set.
      </p>
      <a
        href={token ? cursorDeepLink(token) : undefined}
        aria-disabled={!token}
        onClick={(e) => {
          if (!token) e.preventDefault();
        }}
        className={`btn-senix btn-senix-primary mt-4 ${
          token ? '' : 'pointer-events-none opacity-50'
        }`}
      >
        <ArrowRight size={15} />
        Add to Cursor
      </a>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-4 block text-xs text-secondary transition-colors hover:text-primary"
      >
        {open ? 'Hide manual config' : 'Or paste the config manually'}
      </button>
      {open && (
        <div className="mt-3">
          <ConfigBlock config={cursorConfigJson(token)} />
          <p className="mt-3 font-mono text-xs text-muted">{location}</p>
        </div>
      )}
    </div>
  );
}

function ClaudeCodeInstall({ token }: { token: string | null }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const command = claudeCodeCliCommand(token);
  return (
    <div>
      <p className="text-sm leading-relaxed text-secondary">
        Copy this command, paste it in your terminal, then restart Claude Code.
      </p>
      <div className="relative mt-4">
        <pre className="overflow-x-auto rounded-lg bg-surface-raised p-4 pr-12 font-mono text-xs leading-relaxed text-secondary">
          <span className="mr-2 select-none text-muted">
            <Terminal size={13} className="inline" />
          </span>
          {command}
        </pre>
        <div className="absolute right-2 top-2">
          <CopyButton value={command} iconOnly />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-4 block text-xs text-secondary transition-colors hover:text-primary"
      >
        {open ? 'Hide manual config' : 'Or edit .mcp.json manually'}
      </button>
      {open && (
        <div className="mt-3">
          <ConfigBlock config={claudeCodeConfigJson(token)} />
          <p className="mt-3 font-mono text-xs text-muted">.mcp.json (project) or your global Claude Code config</p>
        </div>
      )}
    </div>
  );
}

function ConfigInstall({
  config,
  location,
  docsUrl,
}: {
  config: string;
  location: string;
  docsUrl?: string;
}): React.ReactElement {
  return (
    <div>
      <p className="text-sm leading-relaxed text-secondary">
        Copy this config into your MCP settings, then restart your editor.
      </p>
      <div className="mt-4">
        <ConfigBlock config={config} />
      </div>
      <p className="mt-3 font-mono text-xs text-muted">{location}</p>
      {docsUrl && (
        <a
          href={docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs text-secondary transition-colors duration-150 hover:text-primary"
        >
          Open the editor&apos;s MCP docs
          <ArrowRight size={12} />
        </a>
      )}
    </div>
  );
}

function ConfigBlock({ config }: { config: string }): React.ReactElement {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-surface-raised p-4 pr-12 font-mono text-xs leading-relaxed text-secondary">
        {config}
      </pre>
      <div className="absolute right-2 top-2">
        <CopyButton value={config} iconOnly />
      </div>
    </div>
  );
}

type TestState = 'idle' | 'testing' | 'connected' | 'pending' | 'invalid';

type TestResponse = {
  status?: 'connected' | 'token_valid' | 'invalid';
  error?: string;
  message?: string;
};

function TestStep({ token }: { token: string | null }): React.ReactElement {
  const [state, setState] = useState<TestState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function test(): Promise<void> {
    if (!token) return;
    setState('testing');
    setMessage(null);
    try {
      const res = await fetch('/api/mcp/test', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as TestResponse;
      if (data.status === 'connected') {
        setState('connected');
      } else if (data.status === 'token_valid') {
        setState('pending');
        setMessage(data.message ?? 'Token valid, but no IDE has connected yet.');
      } else {
        setState('invalid');
        setMessage(data.error ?? 'Invalid token.');
      }
    } catch {
      setState('invalid');
      setMessage('Could not reach Senix. Check your connection and try again.');
    }
  }

  return (
    <StepBox step={3} title="Restart your IDE and test" done={state === 'connected'}>
      <div className="space-y-3 text-sm leading-relaxed text-secondary">
        <p className="flex items-start gap-2">
          <RotateCw size={15} className="mt-0.5 shrink-0 text-muted" />
          Quit your IDE completely and reopen it. Some IDEs only load MCP servers on a full
          restart.
        </p>
        <p>
          Then ask the chat:{' '}
          <span className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-xs text-primary">
            Use Senix to review my changes.
          </span>
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={test}
          disabled={!token || state === 'testing'}
          className="btn-senix btn-senix-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state === 'testing' ? <Loader2 size={15} className="animate-spin" /> : null}
          {state === 'testing' ? 'Testing' : 'Test connection'}
        </button>

        {state === 'connected' && (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent-hover">
            <Check size={15} />
            Connected
          </span>
        )}
        {state === 'pending' && (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-risk-medium/30 bg-risk-medium/10 px-3 py-1.5 text-sm font-medium text-risk-medium">
            <TriangleAlert size={15} />
            Token valid but IDE not connected yet
          </span>
        )}
        {state === 'invalid' && (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-risk-high/30 bg-risk-high/10 px-3 py-1.5 text-sm font-medium text-risk-high">
            <TriangleAlert size={15} />
            Invalid token
          </span>
        )}
      </div>
      {(state === 'pending' || state === 'invalid') && message && (
        <p className="mt-2 text-xs text-muted">{message}</p>
      )}
    </StepBox>
  );
}

function CopyButton({
  value,
  iconOnly = false,
}: {
  value: string;
  iconOnly?: boolean;
}): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast('Copied to clipboard.', 'neutral');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked; the block is selectable as a fallback.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Copied' : 'Copy'}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm text-secondary transition-colors duration-150 hover:text-primary"
    >
      <span className="relative inline-block h-[15px] w-[15px]">
        <Copy
          size={15}
          className={`absolute inset-0 transition-opacity duration-150 ${
            copied ? 'opacity-0' : 'opacity-100'
          }`}
        />
        <Check
          size={15}
          className={`absolute inset-0 text-accent transition-opacity duration-150 ${
            copied ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </span>
      {!iconOnly && <span>{copied ? 'Copied' : 'Copy'}</span>}
    </button>
  );
}
