Senix needs three focused improvements: (1) split navigation so logged-in users see app nav, not marketing nav, (2) replace the mailto feedback link with a real in-app feedback form that saves to Supabase, (3) make the docs page actually useful with proper installation guides, configuration, and troubleshooting.

DESIGN PRINCIPLE:
Logged-in users see a focused app — no marketing nav cluttering their workspace. Feedback is a real form, not an email handoff. Docs read like real product documentation (Stripe, Vercel, Supabase quality), not placeholders.

CONTEXT TO READ FIRST:
1. src/components/site-nav.tsx — the current nav being used everywhere
2. src/app/dashboard/layout.tsx — currently uses site-nav
3. src/app/page.tsx — public landing
4. src/app/docs/page.tsx — current minimal docs
5. src/lib/supabase.ts — admin client for saving feedback
6. docs/schema.md — for understanding the database
7. /mnt/skills/public/frontend-design/SKILL.md — follow this skill's guidance

CONVENTIONS:
- TypeScript strict, no `any`
- Server components by default
- Tailwind only — dark zinc + green-500 brand palette
- Sentence case in copy
- Mobile responsive
- Don't change backend logic, RLS policies, worker code, LLM providers, or prompts

PART 1 — SPLIT NAVIGATION

TASK 1 — Create a dedicated app nav for logged-in users.
Create src/components/app-nav.tsx as a server component. This nav appears only inside /dashboard/* routes. It contains:

- Left: senix logo + wordmark (links to /dashboard)
- Center: nothing for now (keep clean)
- Right: 
  - User avatar + username (text-zinc-200)
  - Vertical divider (border-l border-zinc-800 h-6 mx-3)
  - "Feedback" button (opens the feedback modal — see PART 2)
  - "Sign out" button with LogOut icon from lucide-react

This nav does NOT show Product, How it works, Pricing, Docs, Changelog. Those are marketing-only.

TASK 2 — Update src/app/dashboard/layout.tsx.
Replace the current `<SiteNav>` with `<AppNav>`. Keep the rest of the layout intact.

TASK 3 — Keep SiteNav for public pages.
SiteNav stays on /, /pricing, /docs, /changelog, /login (and any future marketing pages). Don't touch those.

PART 2 — REAL FEEDBACK FORM

TASK 4 — Create a feedback table migration.
Generate docs/migrations/005-feedback.sql:

CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('bug', 'feature', 'question', 'other')),
  message TEXT NOT NULL,
  page_url TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY feedback_insert_self ON feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- Users can see their own feedback
CREATE POLICY feedback_select_self ON feedback
  FOR SELECT
  TO authenticated
  USING (
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

Don't run the migration — leave for manual execution.

TASK 5 — Build the feedback modal component.
Create src/components/feedback-modal.tsx as a 'use client' component. When the "Feedback" button in app nav is clicked, this modal opens.

Modal contents:
- Centered overlay with backdrop blur
- Heading: "Send feedback"
- Subhead: "Help us make Senix better. We read every submission."
- Category dropdown: Bug report / Feature request / Question / Other
- Textarea for the message (min 20 chars, max 2000)
- "Cancel" and "Send" buttons (Send is primary, disabled until message has 20+ chars)
- On submit: calls a server action
- Success state: shows "Thanks — we got it. We'll follow up via email if needed." with a green check icon, then auto-closes after 3 seconds

TASK 6 — Build the feedback server action.
Create src/app/dashboard/feedback-actions.ts:

Export `submitFeedback(category, message)` as a 'use server' function. It:
1. Gets the current user
2. Throws if not authenticated
3. Looks up the user's row id from users table by auth_user_id
4. Inserts a new feedback row with user_id, category, message, page_url (from headers if available), user_agent (from headers if available)
5. Returns { ok: true } on success or { ok: false, error: string }

TASK 7 — Add a simple admin view at /internal/feedback.
Create src/app/internal/feedback/page.tsx (Basic Auth protected via existing middleware). Server component that:
- Queries all feedback ordered by created_at desc
- Shows each entry as a card: category badge, message, user (email/github_username), page_url, timestamp, status
- Group by status (Open at top, then In Progress, then Resolved, then Closed)
- No interactive controls yet — just read-only view. We'll add status changes later.

PART 3 — REAL DOCS

TASK 8 — Restructure src/app/docs/page.tsx.
Currently has placeholder content. Rebuild as a proper docs page with sidebar navigation.

Layout: Two columns on desktop (sticky left sidebar with section links + right content), single column on mobile.

Sidebar sections (each anchor-linked from the right):
1. Getting started
2. Installing the GitHub App
3. How Senix analyzes PRs
4. Risk flag reference
5. Configuration
6. Troubleshooting
7. FAQ
8. API reference (placeholder for now)

Content for each section (write real content, not Lorem Ipsum):

GETTING STARTED:
- 30-second pitch
- 3-step quickstart: 1) sign in with GitHub, 2) install Senix-bot, 3) open a PR
- Screenshot placeholder (just a styled gray div with "Quickstart screenshot" text — we'll add real images later)

INSTALLING THE GITHUB APP:
- Step-by-step: sign in, click "Install GitHub App", choose org/account, select repos, authorize
- Note about needing org admin permission for org installs
- What permissions Senix requests and why (read code, write to PR comments)
- How to revoke / uninstall

HOW SENIX ANALYZES PRS:
- The pipeline in plain language: webhook → structural diff → LLM analysis → comment
- What "structural diff" means (we use tree-sitter to parse code into symbols, not just text lines)
- Currently supported languages: JavaScript, TypeScript, TSX, Python
- Average latency: 20-40 seconds per PR

RISK FLAG REFERENCE:
- Table with all 8 risk flags and their definitions:
  - sql-injection: Raw user input concatenated into SQL queries
  - auth-change: Modification of authentication or authorization checks
  - removed-validation: Input or schema validation was removed
  - hardcoded-secret: API key, token, or password literal in source code
  - new-external-api: New outbound HTTP call to third-party service
  - dependency-added: New third-party package import
  - payment-logic-change: Changes to money, prices, discounts, or fees
  - data-leak: Code path that exposes data to unauthorized parties
- For each flag, show the format as a code chip (font-mono bg-zinc-900 border border-zinc-800)
- Note that risk flags are stable — we won't rename them without a deprecation period

CONFIGURATION:
- How to enable/disable specific repos via the dashboard
- How to uninstall the GitHub App
- (Future: how to configure risk thresholds — leave as "coming soon")

TROUBLESHOOTING:
- "My PR didn't get a comment" — possible causes:
  * Repo is disabled in dashboard
  * Webhook delivery failed (check installation in GitHub settings)
  * PR has no supported file types (only JS/TS/TSX/Python analyzed)
- "I got the wrong risk level" — explain that the prompt is calibrated against our eval set, and feedback is welcomed
- "The bot comment didn't update on my new push" — Senix updates the existing comment, not creates a new one. Refresh the PR page.
- "I deleted the bot comment" — Senix will post a new one on the next push

FAQ:
- Is Senix free? — Yes, during beta. Paid plans coming soon.
- Does Senix store my code? — Only structural diff metadata, not raw code.
- Can I self-host? — Not currently. Reach out via Feedback if interested.
- What LLM does Senix use? — DeepSeek for analysis. Anthropic Claude for some operations.
- How accurate is it? — v2 prompt scores 94% on our internal eval set.

API REFERENCE:
- Placeholder: "Coming soon. Senix API will let you integrate analysis directly into your tools."

Styling notes:
- Each section: H2 in text-2xl font-semibold, then body text in text-zinc-300
- Code blocks: bg-zinc-900 border border-zinc-800 rounded-md p-4 font-mono text-sm
- Inline code: bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-sm font-mono
- Sidebar links: text-zinc-400 hover:text-zinc-100 with smooth scroll behavior
- Active section link: text-green-400 (use IntersectionObserver to highlight current section)

TASK 9 — Verify build.
Run `npx tsc --noEmit` and `npm run build`. Report results.

OUTPUT REQUIREMENTS:
- Show me each new and modified file in full
- Don't change the worker, LLM providers, prompts, eval scripts, or RLS migrations
- Don't change other marketing pages (pricing, changelog) — they stay as-is
- If the feedback table conflicts with existing tables in schema.md, flag before proceeding