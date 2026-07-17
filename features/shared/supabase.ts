import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role client for server-side use only. Bypasses RLS.
 *
 * Lazily initialized behind a Proxy: on Cloudflare Workers, env bindings do
 * not exist at module-evaluation time (Worker __init), only inside an
 * invocation, so creating the client at top level crashes any entry point
 * that imports app code before env hydration (this exact crash happened at
 * deploy validation on 2026-07-17 via the Workflow entry). The Proxy defers
 * createClient() to the first property access, by which point every caller
 * (Next request contexts, Workflow steps after the worker.ts shell hydrates
 * process.env, the standalone Node worker) has a populated process.env — a
 * behavioral no-op for all of them.
 */
let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
  }
  return client;
}

export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, _receiver) {
    const instance = getClient();
    const value = Reflect.get(instance, prop, instance);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
