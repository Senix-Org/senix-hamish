import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@features/shared/supabase';
import { formatShippingBrief, runAnalysis } from '@features/ai-engine/analyze-changes';
import {
  checkTokenLimit,
  recordTokenUsage,
  ESTIMATED_TOKENS_PER_REVIEW,
} from '@features/billing/plan-limits';
import { checkMcpRateLimit } from '@features/billing/mcp-rate-limit';
import { getAppBaseUrl } from '@features/shared/mcp-config';
import { postMcpReviewToGithub } from '@features/github-integration/post-mcp-review';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * MCP server for Senix.
 *
 * IDEs (Cursor, Claude Code, Windsurf, …) connect to this endpoint and
 * expose the `review_changes` tool to the developer's AI assistant. The
 * legacy name `analyze_code_changes` still works as an alias so older IDE
 * configs keep functioning. The tool reuses the exact same pipeline as the
 * GitHub bot — tree-sitter structural diff + the shared LLM provider + the
 * shared analysis prompt. Only the input source differs: a PR diff for the
 * bot, IDE-supplied file contents here.
 *
 * Unlike the short GitHub PR comment, the MCP tool returns a full shipping
 * brief: a behavioral summary, the overall risk level, a ship decision,
 * the risky files with line ranges and verification guidance, and a list
 * of verification steps to run before shipping.
 *
 * Transport: MCP Streamable HTTP (spec rev 2025-03-26) with a legacy
 * JSON-RPC fallback. A single endpoint serves both POST and GET. POST
 * carries the JSON-RPC request; the response comes back as an SSE stream
 * when the client sends `Accept: text/event-stream`, or as a plain JSON
 * body for older JSON-RPC-only clients. GET opens the server->client SSE
 * channel. The negotiated `MCP-Protocol-Version` is echoed on responses.
 * Rather than adapt the stateful `@modelcontextprotocol/sdk` HTTP
 * transport (built for long-lived Node `http` servers) onto a stateless
 * Vercel route handler, we implement the message types we need directly.
 *
 * ----------------------------------------------------------------------
 * Example MCP request (what an IDE sends for `tools/call`):
 *
 *   POST /api/mcp
 *   Authorization: Bearer sk_mcp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *   Content-Type: application/json
 *
 *   {
 *     "jsonrpc": "2.0",
 *     "id": 2,
 *     "method": "tools/call",
 *     "params": {
 *       "name": "review_changes",
 *       "arguments": {
 *         "changes": [
 *           {
 *             "file_path": "src/checkout.ts",
 *             "language": "typescript",
 *             "before": "export function total(items) { return sum(items); }",
 *             "after": "export function total(items) { return sum(items) * 1.2; }"
 *           }
 *         ],
 *         "context": "feature: applying tax to order totals"
 *       }
 *     }
 *   }
 *
 * Example MCP response:
 *
 *   {
 *     "jsonrpc": "2.0",
 *     "id": 2,
 *     "result": {
 *       "content": [
 *         { "type": "text", "text": "Senix reviewed 1 changed file.\n\nOverall risk: HIGH\n..." }
 *       ],
 *       "structuredContent": {
 *         "summary": "...",
 *         "riskLevel": "high",
 *         "riskFlags": ["payment-logic-change"],
 *         "focusAreas": [ ... ],
 *         "shipDecision": "do not ship until fixed",
 *         "riskyFiles": [ ... ],
 *         "verificationSteps": [ ... ]
 *       }
 *     }
 *   }
 * ----------------------------------------------------------------------
 */

const PROTOCOL_VERSION = '2025-06-18';
// Protocol versions this server can speak. The newest is the default; older
// clients (including the original 2024-11-05 JSON-RPC clients) still work.
const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER_INFO = { name: 'senix', version: '1.0.0' };

/** Natural-language instructions shown to the user by compliant MCP clients. */
const SERVER_INSTRUCTIONS =
  'Senix reviews code changes for production risk. Ask your AI assistant to "review my changes with Senix" before committing. Provide before/after file contents for each changed file. You\'ll get a shipping brief with a risk level, risky files with line ranges, and verification steps.';

// Canonical tool name plus the legacy alias kept for older IDE configs.
const TOOL_NAME = 'review_changes';
const TOOL_ALIAS = 'analyze_code_changes';

const TOOL_DEFINITION = {
  name: TOOL_NAME,
  description:
    'Use this tool whenever the user asks Senix to review code, check changes, review before commit, find risky code, inspect AI-generated code, or check a git diff. Returns a shipping brief with a behavioral summary, risk level, risky files with line ranges and verification steps, and a ship decision.',
  inputSchema: {
    type: 'object',
    properties: {
      changes: {
        type: 'array',
        description: 'Array of file changes to analyze',
        items: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'Relative path to the file' },
            language: {
              type: 'string',
              description: 'Programming language (javascript, typescript, tsx, python)',
            },
            before: {
              type: 'string',
              description: 'File content before the change. Empty string for new files.',
            },
            after: {
              type: 'string',
              description: 'File content after the change. Empty string for deletions.',
            },
          },
          required: ['file_path', 'before', 'after'],
        },
      },
      context: {
        type: 'string',
        description:
          "Optional context about the change (e.g., 'feature: adding payment processing')",
      },
      repo: {
        type: 'string',
        description:
          "Optional GitHub repository in 'owner/name' form. When provided together with pr_number, and the repo belongs to a linked Senix GitHub installation, the review is also posted as a PR comment.",
      },
      pr_number: {
        type: 'number',
        description:
          'Optional pull request number. Combined with `repo`, posts the review as a GitHub PR comment in addition to returning it here.',
      },
    },
    required: ['changes'],
  },
} as const;

// JSON-RPC 2.0 error codes.
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INTERNAL_ERROR = -32603;
const MONTHLY_LIMIT_REACHED = -32000;
const RATE_LIMIT_REACHED = -32001;

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
};

type McpTokenRow = { id: string; user_id: string };

/**
 * A handled JSON-RPC call, decoupled from the wire format. The POST
 * handler serializes this either as a plain `application/json` body
 * (legacy JSON-RPC clients) or as a one-message `text/event-stream`
 * (Streamable HTTP clients), based on the request's Accept header.
 */
type RpcOutcome = {
  message: Record<string, unknown>;
  httpStatus: number;
};

function rpcResult(id: JsonRpcId, result: unknown): RpcOutcome {
  return { message: { jsonrpc: '2.0', id, result }, httpStatus: 200 };
}

function rpcError(
  id: JsonRpcId,
  code: number,
  message: string,
  httpStatus = 200
): RpcOutcome {
  return { message: { jsonrpc: '2.0', id, error: { code, message } }, httpStatus };
}

/** True when the client is willing to accept a Streamable HTTP SSE stream. */
function acceptsEventStream(req: NextRequest): boolean {
  return (req.headers.get('accept') ?? '').includes('text/event-stream');
}

/**
 * Negotiate the MCP protocol version from the request header, defaulting
 * to the newest supported version. Unknown versions are tolerated (we
 * just fall back to the default) so we never hard-fail a slightly-off
 * client. The chosen version is echoed back on every response.
 */
function negotiateProtocolVersion(req: NextRequest): string {
  const requested = req.headers.get('mcp-protocol-version');
  if (requested && SUPPORTED_PROTOCOL_VERSIONS.includes(requested)) {
    return requested;
  }
  return PROTOCOL_VERSION;
}

/** Serialize an outcome as a plain JSON-RPC response. */
function jsonResponse(outcome: RpcOutcome, protocolVersion: string): NextResponse {
  return NextResponse.json(outcome.message, {
    status: outcome.httpStatus,
    headers: { 'MCP-Protocol-Version': protocolVersion },
  });
}

/** Serialize an outcome as a single-message Streamable HTTP SSE stream. */
function sseResponse(outcome: RpcOutcome, protocolVersion: string): NextResponse {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const payload = JSON.stringify(outcome.message);
      controller.enqueue(encoder.encode(`event: message\ndata: ${payload}\n\n`));
      controller.close();
    },
  });

  return new NextResponse(stream, {
    status: outcome.httpStatus,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'MCP-Protocol-Version': protocolVersion,
    },
  });
}

/**
 * Verify the `Authorization: Bearer …` token against `mcp_tokens`.
 * Tokens are stored hashed, so we hash the presented token and look up
 * the row. Bumps `last_used_at` on success. Uses `supabaseAdmin` because
 * the MCP route has no user session.
 */
async function verifyToken(req: NextRequest): Promise<McpTokenRow | null> {
  const header = req.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const presented = match[1].trim();
  const tokenHash = createHash('sha256').update(presented).digest('hex');

  const { data } = (await supabaseAdmin
    .from('mcp_tokens')
    .select('id, user_id')
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .maybeSingle()) as unknown as { data: McpTokenRow | null };

  if (!data) return null;

  await supabaseAdmin
    .from('mcp_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);

  return data;
}

/**
 * If the caller named a repo + PR and that repo is a linked GitHub
 * installation they own, also post the review as a PR comment. Returns a
 * short status string for the structured response, or null when no GitHub
 * delivery was requested. Never throws — the editor chat result is the
 * primary output and must not be blocked by a failed comment.
 */
async function maybeDeliverToGithub(
  args: Record<string, unknown>,
  userId: string,
  result: Awaited<ReturnType<typeof runAnalysis>>['result']
): Promise<{ posted: boolean; commentUrl?: string; reason?: string } | null> {
  const repo = typeof args.repo === 'string' ? args.repo.trim() : '';
  const prNumber = typeof args.pr_number === 'number' ? args.pr_number : null;
  if (!repo || prNumber === null) return null;

  const outcome = await postMcpReviewToGithub({ userId, repoFullName: repo, prNumber, result });
  return outcome.posted
    ? { posted: true, commentUrl: outcome.commentUrl }
    : { posted: false, reason: outcome.reason };
}

/** Dispatch a single JSON-RPC request to the matching MCP method. */
async function handleRpc(rpc: JsonRpcRequest, token: McpTokenRow): Promise<RpcOutcome> {
  const id = rpc.id ?? null;

  switch (rpc.method) {
    case 'initialize': {
      const requestedRaw = (rpc.params?.protocolVersion as string) || PROTOCOL_VERSION;
      const negotiated = SUPPORTED_PROTOCOL_VERSIONS.includes(requestedRaw)
        ? requestedRaw
        : PROTOCOL_VERSION;
      return rpcResult(id, {
        protocolVersion: negotiated,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions: SERVER_INSTRUCTIONS,
      });
    }

    case 'tools/list':
      return rpcResult(id, { tools: [TOOL_DEFINITION] });

    case 'tools/call': {
      const name = rpc.params?.name;
      // `analyze_code_changes` is the legacy alias; both route here.
      if (name !== TOOL_NAME && name !== TOOL_ALIAS) {
        return rpcError(id, METHOD_NOT_FOUND, `Unknown tool: ${String(name)}`);
      }
      const args = (rpc.params?.arguments ?? {}) as Record<string, unknown>;
      try {
        // Per-user short-window rate limit (defence-in-depth on top of the
        // monthly token budget). Prevents a runaway IDE from burning cost
        // before the monthly cap catches up.
        const rateLimit = await checkMcpRateLimit(token.user_id);
        if (!rateLimit.allowed) {
          const retryAfter = Math.ceil(rateLimit.resetsAt - Date.now() / 1000);
          return rpcError(
            id,
            RATE_LIMIT_REACHED,
            `Rate limit: too many requests. Try again in ${Math.max(1, retryAfter)} seconds.`
          );
        }

        const limit = await checkTokenLimit(token.user_id, ESTIMATED_TOKENS_PER_REVIEW, 'mcp');
        if (!limit.allowed) {
          return rpcError(
            id,
            MONTHLY_LIMIT_REACHED,
            `Monthly token budget reached. Upgrade at ${getAppBaseUrl()}/dashboard/billing`
          );
        }

        const { result, filesReviewed } = await runAnalysis(args);

        // True usage up from the reserved estimate to the actual count. Never
        // let a usage bookkeeping failure break the review the user received.
        try {
          await recordTokenUsage(token.user_id, result.tokensUsed, 'mcp', ESTIMATED_TOKENS_PER_REVIEW);
        } catch (usageErr) {
          console.error('[mcp] failed to record token usage', usageErr);
        }

        // Editor chat is always the primary output; PR delivery is an
        // optional best-effort second channel.
        const github = await maybeDeliverToGithub(args, token.user_id, result);

        let text = formatShippingBrief(result, filesReviewed);
        if (github?.posted) {
          text += `\n\nAlso posted as a comment on the pull request: ${github.commentUrl}`;
        }

        return rpcResult(id, {
          content: [{ type: 'text', text }],
          structuredContent: {
            summary: result.summary,
            riskLevel: result.riskLevel,
            riskFlags: result.riskFlags,
            focusAreas: result.focusAreas,
            shipDecision: result.shipDecision,
            riskyFiles: result.riskyFiles,
            verificationSteps: result.verificationSteps,
            githubComment: github,
          },
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        // Tool-level failures are reported inside the result with isError,
        // per the MCP spec — not as a JSON-RPC protocol error.
        return rpcResult(id, {
          content: [{ type: 'text', text: `Analysis failed: ${message}` }],
          isError: true,
        });
      }
    }

    case 'ping':
      return rpcResult(id, {});

    default:
      return rpcError(id, METHOD_NOT_FOUND, `Method not supported: ${rpc.method}`);
  }
}

/**
 * Streamable HTTP (and legacy JSON-RPC) endpoint.
 *
 * POST carries a JSON-RPC request. The response is returned either as a
 * Streamable HTTP SSE stream (when the client sends
 * `Accept: text/event-stream`) or as a plain JSON body (legacy clients).
 * Both paths carry the negotiated `MCP-Protocol-Version` header.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const protocolVersion = negotiateProtocolVersion(req);
  const wantsStream = acceptsEventStream(req);
  const send = (outcome: RpcOutcome): NextResponse =>
    wantsStream ? sseResponse(outcome, protocolVersion) : jsonResponse(outcome, protocolVersion);

  const token = await verifyToken(req);
  if (!token) {
    return send(rpcError(null, INVALID_REQUEST, 'Unauthorized: invalid or missing MCP token', 401));
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return send(rpcError(null, PARSE_ERROR, 'Invalid JSON body'));
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return send(rpcError(null, INVALID_REQUEST, 'Expected a single JSON-RPC request object'));
  }

  const rpc = body as JsonRpcRequest;
  if (rpc.jsonrpc !== '2.0' || typeof rpc.method !== 'string') {
    return send(rpcError(rpc.id ?? null, INVALID_REQUEST, 'Malformed JSON-RPC 2.0 request'));
  }

  // Notifications (no `id`) expect no response body — e.g.
  // `notifications/initialized` sent right after `initialize`.
  if (rpc.id === undefined || rpc.id === null) {
    return new NextResponse(null, {
      status: 202,
      headers: { 'MCP-Protocol-Version': protocolVersion },
    });
  }

  try {
    return send(await handleRpc(rpc, token));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return send(rpcError(rpc.id, INTERNAL_ERROR, message));
  }
}

/**
 * GET opens the Streamable HTTP server->client SSE channel when the
 * client asks for `text/event-stream`. Senix has no unsolicited
 * server-initiated messages, so the stream simply stays open with
 * periodic keep-alive comments until the client disconnects. A plain
 * browser or health check (no event-stream Accept) gets a small
 * discovery descriptor instead.
 *
 * The SSE channel is authenticated with the same Bearer token as POST,
 * so an unauthenticated client cannot hold a connection open.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const protocolVersion = negotiateProtocolVersion(req);

  if (!acceptsEventStream(req)) {
    return NextResponse.json(
      {
        name: SERVER_INFO.name,
        protocol: 'mcp',
        transport: 'streamable-http',
        protocolVersion,
        methods: ['initialize', 'tools/list', 'tools/call', 'ping'],
      },
      { headers: { 'MCP-Protocol-Version': protocolVersion } }
    );
  }

  const token = await verifyToken(req);
  if (!token) {
    return new NextResponse(null, {
      status: 401,
      headers: { 'MCP-Protocol-Version': protocolVersion },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(': connected\n\n'));
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch {
          clearInterval(keepAlive);
        }
      }, 15000);
      const close = () => {
        clearInterval(keepAlive);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      req.signal.addEventListener('abort', close);
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'MCP-Protocol-Version': protocolVersion,
    },
  });
}

/**
 * DELETE terminates a session. Senix is stateless (no Mcp-Session-Id),
 * so there is no server-side session to clean up. We respond 200 OK so
 * spec-compliant clients that send DELETE on disconnect do not receive
 * an error.
 */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const protocolVersion = negotiateProtocolVersion(req);
  return new NextResponse(null, {
    status: 200,
    headers: { 'MCP-Protocol-Version': protocolVersion },
  });
}
