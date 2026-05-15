'use server';

import { headers } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';

type Category = 'bug' | 'feature' | 'question' | 'other';

const VALID_CATEGORIES: ReadonlySet<Category> = new Set(['bug', 'feature', 'question', 'other']);
const MIN_LEN = 20;
const MAX_LEN = 2000;

type SubmitArgs = {
  category: Category;
  message: string;
  pageUrl?: string;
};

type SubmitResult = { ok: true } | { ok: false; error: string };

type AppUserRow = { id: string };

/**
 * Persist a feedback submission. Requires a signed-in user; resolves
 * the app `users.id` from the auth session and inserts via the
 * service-role client so we don't depend on the caller's RLS policies
 * for INSERT writes.
 */
export async function submitFeedback(args: SubmitArgs): Promise<SubmitResult> {
  const category = args.category;
  const message = args.message?.trim() ?? '';

  if (!VALID_CATEGORIES.has(category)) {
    return { ok: false, error: 'Invalid category.' };
  }
  if (message.length < MIN_LEN) {
    return { ok: false, error: `Message must be at least ${MIN_LEN} characters.` };
  }
  if (message.length > MAX_LEN) {
    return { ok: false, error: `Message must be ${MAX_LEN} characters or fewer.` };
  }

  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return { ok: false, error: 'Not signed in.' };
  }

  const { data: appUser } = (await supabaseAdmin
    .from('users')
    .select('id')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle()) as unknown as { data: AppUserRow | null };

  if (!appUser) {
    return { ok: false, error: 'No linked user record.' };
  }

  const hdrs = await headers();
  const userAgent = hdrs.get('user-agent') ?? null;
  const pageUrl = args.pageUrl ?? hdrs.get('referer') ?? null;

  const { error } = await supabaseAdmin.from('feedback').insert({
    user_id: appUser.id,
    category,
    message,
    page_url: pageUrl,
    user_agent: userAgent,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
