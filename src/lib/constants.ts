/**
 * Cap on live (non-revoked) MCP tokens per user. Enforced by BOTH minting
 * paths: the API route (src/app/api/mcp/token/route.ts, used by the Connect
 * IDE flow) and the server action (src/app/dashboard/tokens/actions.ts, used
 * by the tokens page). Revoking a token frees a slot on either path.
 */
export const MAX_TOKENS_PER_USER = 10;

// PostHog server-event validation marker (2026-07-17): trivial change to
// trigger a real pr_review_completed event through the analysis pipeline.
// Safe to delete.
