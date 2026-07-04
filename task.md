You are working on Senix, a code review tool built with Next.js, 
Tailwind CSS, and Supabase. You are implementing real pricing tiers, 
rate limiting, and Whop payment integration.

WRITING STYLE RULES
Do not use em-dashes or en-dashes. Use commas, periods, or parentheses 
instead. Write complete sentences with normal punctuation. Do not use 
bullet lists with dashes in UI copy. Keep all UI text clear and direct.

CONTEXT
The current Senix users table has these columns:
- id (uuid)
- auth_user_id (uuid)
- github_username (text)
- github_user_id (bigint)
- email (text)
- created_at (timestamp with time zone)

There is no plan column yet. There is no rate limiting. Anyone who 
signs up gets unlimited everything. That changes with this build.

WHOP CREDENTIALS (use these as environment variable names)
- WHOP_API_KEY (value already set)
- WHOP_WEBHOOK_SECRET (value already set)
- WHOP_STARTER_PRODUCT_ID = prod_2mMPi5Lwhvmdn
- WHOP_TEAM_PRODUCT_ID = prod_gVtESTLqdLTRD
- WHOP_PRO_PRODUCT_ID = prod_8vnwEeSVSw2de

PRICING TIERS
Four tiers. These are the source of truth for the entire implementation.

Free:
- Price: $0, no payment required
- Repos: 1
- Reviews per month: 30 (PR reviews and MCP reviews combined)
- Support: Community
- Trial: None, permanent free

Starter:
- Price: $18/month
- Repos: 3
- Reviews per month: 200
- Support: Community
- Trial: 14 days free

Team:
- Price: $79/month
- Repos: 15
- Reviews per month: 1000
- Support: Email, 48 hour response
- Trial: 14 days free

Pro:
- Price: $199/month
- Repos: Unlimited (store as -1 in the database)
- Reviews per month: 5000
- Support: Priority, 24 hour response
- Trial: 14 days free

DATABASE MIGRATIONS
Create a new migration file at supabase/migrations/008_pricing.sql.
Do not run it. The operator will run it manually.

Add these columns to the users table:
- plan: text not null default 'free' 
  (values: 'free', 'starter', 'team', 'pro')
- plan_status: text not null default 'active' 
  (values: 'active', 'trialing', 'cancelled', 'past_due')
- trial_ends_at: timestamp with time zone nullable
- plan_expires_at: timestamp with time zone nullable
- whop_membership_id: text nullable (the Whop membership ID for 
  this user's subscription, used to verify and manage their plan)
- pr_reviews_this_month: integer not null default 0
- mcp_reviews_this_month: integer not null default 0
- reviews_reset_at: timestamp with time zone not null 
  default date_trunc('month', now())
- repos_connected: integer not null default 0

Also create a new table called plan_events to log every plan change:
- id: uuid primary key default gen_random_uuid()
- user_id: uuid references users(id)
- event_type: text (values: 'upgraded', 'downgraded', 'trial_started', 
  'trial_ended', 'cancelled', 'reactivated', 'payment_failed')
- from_plan: text nullable
- to_plan: text nullable
- whop_event_id: text nullable
- created_at: timestamp with time zone default now()

PLAN ENFORCEMENT LOGIC
Create src/lib/plan-limits.ts. This is the single source of truth 
for plan limits and enforcement. Export these:

1. A PLAN_LIMITS constant object:
const PLAN_LIMITS = {
  free:    { repos: 1,  reviews: 30,   label: 'Free' },
  starter: { repos: 3,  reviews: 200,  label: 'Starter' },
  team:    { repos: 15, reviews: 1000, label: 'Team' },
  pro:     { repos: -1, reviews: 5000, label: 'Pro' },
}

2. A getUserPlan(userId) async function that:
   - Queries the users table for the user's plan, plan_status, 
     trial_ends_at, pr_reviews_this_month, mcp_reviews_this_month, 
     reviews_reset_at, and repos_connected
   - Checks if reviews_reset_at is in a past month. If yes, 
     resets pr_reviews_this_month and mcp_reviews_this_month to 0 
     and updates reviews_reset_at to the start of the current month
   - Returns the user's plan data including total reviews used 
     (pr_reviews_this_month + mcp_reviews_this_month) and limit

3. A checkReviewLimit(userId, source) async function where source 
   is 'pr' or 'mcp':
   - Calls getUserPlan
   - If the user is on a cancelled or past_due plan with no active 
     trial, treat them as free tier
   - Compares total reviews used against their plan limit
   - If at or over the limit, return { allowed: false, reason: string }
   - If under the limit, increment the appropriate counter 
     (pr_reviews_this_month or mcp_reviews_this_month) and return 
     { allowed: true }
   - Use a Supabase UPDATE with a WHERE clause that checks the 
     current count has not changed since the read (optimistic 
     concurrency to prevent double-counting)

4. A checkRepoLimit(userId) async function:
   - Gets the user's repos_connected count and plan
   - If repos_connected >= plan limit (and plan is not pro), 
     return { allowed: false, reason: string }
   - If allowed, return { allowed: true }

WEBHOOK HANDLER
Create src/app/api/webhooks/whop/route.ts.

This is a POST endpoint. It receives webhook events from Whop.

Security: verify every incoming request by checking the 
x-whop-signature header. Whop signs webhooks using HMAC-SHA256 
with the WHOP_WEBHOOK_SECRET. Verify the signature before 
processing any event. If verification fails, return 401.

Handle these four events:

1. membership_activated:
   - Get the user's email or whop user ID from the event payload
   - Look up the user in the Supabase users table by email
   - Determine which plan they subscribed to by matching 
     the product_id in the payload against the three 
     WHOP_*_PRODUCT_ID environment variables
   - Update the user's plan, plan_status to 'active', 
     whop_membership_id to the membership ID from the payload
   - If this is a trial, set plan_status to 'trialing' and 
     trial_ends_at to the trial end date from the payload
   - Insert a row into plan_events with event_type 'upgraded' 
     or 'trial_started'
   - Return 200

2. membership_deactivated:
   - Find the user by whop_membership_id
   - Set their plan to 'free', plan_status to 'cancelled'
   - Clear whop_membership_id
   - Insert a row into plan_events with event_type 'cancelled'
   - Return 200

3. payment_succeeded:
   - Find the user by whop_membership_id
   - Set plan_status to 'active' (in case it was past_due)
   - Insert a row into plan_events with event_type 'reactivated' 
     if previous status was past_due, otherwise no event
   - Return 200

4. invoice_paid:
   - Same as payment_succeeded handling
   - Return 200

For any unrecognized event type, return 200 without processing 
(Whop requires a 200 response to stop retrying).

Log all webhook events to the console with the event type and 
relevant IDs. Do not throw on processing errors inside the handler. 
Catch errors, log them, and return 200 so Whop does not retry.

CHECKOUT FLOW
Create src/app/api/billing/checkout/route.ts as a POST endpoint.

It takes a plan name in the request body ('starter', 'team', 'pro').
It requires an authenticated session (use existing auth helpers).
It maps the plan name to the correct WHOP_*_PRODUCT_ID.
It calls the Whop API to create a checkout session:
  POST https://api.whop.com/v5/checkout-links
  Authorization: Bearer WHOP_API_KEY
  Body: { product_id, redirect_url, prefill_email }
It returns the checkout URL to the client.

If the plan is 'free', return 400 (free plan does not need checkout).

ENFORCE RATE LIMITS IN EXISTING ROUTES

1. In the MCP route (src/app/api/mcp/route.ts):
   After verifying the MCP token, before calling runAnalysis():
   - Get the user_id from the mcp_tokens table (it already does this)
   - Call checkReviewLimit(userId, 'mcp')
   - If not allowed, return a JSON-RPC error response with code 
     -32000 and message: "Monthly review limit reached. Upgrade 
     your plan at https://senix.dev/dashboard"
   - If allowed, proceed with the analysis

2. In the GitHub webhook handler that processes PR reviews 
   (wherever the PR analysis is triggered):
   - Find the user_id from the installation or repository record
   - Call checkReviewLimit(userId, 'pr')
   - If not allowed, post a comment on the PR saying:
     "Senix monthly review limit reached. Upgrade at 
     https://senix.dev/dashboard to continue 
     reviewing PRs."
   - If allowed, proceed with the analysis

3. When the GitHub App is installed on a new repo:
   - Call checkRepoLimit(userId)
   - If not allowed, respond with an error or post an issue 
     comment saying:
     "Repo limit reached for your current plan. Upgrade at 
     https://senix.dev/dashboard"

DASHBOARD BILLING PAGE
Create src/app/dashboard/billing/page.tsx.

Add "Billing" to the dashboard sidebar nav with a CreditCard 
icon from lucide-react, linking to /dashboard/billing.

The billing page shows:

Current plan section:
- Plan name and status badge (active, trialing, cancelled, past_due)
- If trialing: "Trial ends in N days" in amber text
- If cancelled: "Plan cancelled. Access until [date]." in red text
- Reviews used this month: a progress bar showing 
  used / limit with the numbers below it
  Color: green under 70%, amber between 70% and 90%, red above 90%
- Repos connected: N of N (or "Unlimited" for Pro)

Upgrade section (show only if not on Pro):
- Show the next tier up as the recommended upgrade with its 
  price, repo limit, and review limit
- A single "Upgrade to [plan]" button that calls 
  POST /api/billing/checkout and redirects to the Whop 
  checkout URL
- A "See all plans" link that expands to show all four tiers 
  in a simple comparison table

Manage subscription section (show only if on a paid plan):
- "Cancel subscription" as a quiet text link in text-muted 
  that turns red on hover
- On click, show a confirmation modal: "Are you sure you want 
  to cancel? You will be downgraded to the Free plan at the 
  end of your billing period."
- Cancellation calls the Whop API to cancel the membership:
  DELETE https://api.whop.com/v5/memberships/{whop_membership_id}
  Authorization: Bearer WHOP_API_KEY
- On success, update plan_status to 'cancelled' in Supabase 
  and show a success message

PRICING PAGE UPDATE
Update the public pricing page (wherever the current pricing 
cards are rendered) to match the new four tiers exactly:

Free: $0, 1 repo, 30 reviews/month, community support
Starter: $18/month, 3 repos, 200 reviews/month, community support
Team: $79/month, 15 repos, 1000 reviews/month, email support
Pro: $199/month, unlimited repos, 5000 reviews/month, priority support

The "Start free trial" buttons on Starter, Team, and Pro should 
now call POST /api/billing/checkout with the plan name and 
redirect to Whop checkout. The Free tier button says 
"Get started free" and links to /login.

Remove the "14 days free, no credit card required" text from 
the top of the pricing section. Replace it with: 
"Start free. Upgrade when your team needs more."

WHAT NOT TO CHANGE
Do not change the MCP tool output or shipping brief format. 
Do not change the dashboard design or sidebar from the recent 
design upgrade. Do not change the playground page. Do not 
change the CMA project. Do not modify the GitHub App 
installation flow beyond adding the repo limit check.

NEW ENVIRONMENT VARIABLES NEEDED
WHOP_API_KEY
WHOP_WEBHOOK_SECRET
WHOP_STARTER_PRODUCT_ID=prod_2mMPi5Lwhvmdn
WHOP_TEAM_PRODUCT_ID=prod_gVtESTLqdLTRD
WHOP_PRO_PRODUCT_ID=prod_8vnwEeSVSw2de

WHEN DONE
List every file created or modified. Paste the full contents 
of supabase/migrations/008_pricing.sql. Confirm which existing 
routes now have rate limit checks. Confirm the webhook handler 
verifies signatures before processing. Note any assumptions 
made about the GitHub webhook handler location since you will 
need to find it in the existing codebase.