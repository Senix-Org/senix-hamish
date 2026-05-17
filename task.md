You are working on Senix, an MCP server that reviews code changes. Steps 1 
(shipping brief output and tool rename) and 2 (dashboard onboarding flow) 
are already done and deployed.

WRITING STYLE RULES
Do not use em-dashes or en-dashes. Use commas, periods, or parentheses 
instead. Write complete sentences with normal punctuation. For docs, use 
plain numbered lists, not bullets with dashes. Keep prose clear and direct.

CONTEXT YOU NEED

The review_changes tool expects this argument shape:
{
  "changes": [
    {
      "file_path": "string",
      "language": "string (optional)",
      "before": "string (file content before, empty for new files)",
      "after": "string (file content after, empty for deletions)"
    }
  ],
  "context": "string (optional)"
}

The playground will accept a unified diff string from users. You need to 
parse the diff into the changes array shape before calling the tool. Use 
an existing library if available, do not write a diff parser from scratch.
Recommended: parse-diff (https://www.npmjs.com/package/parse-diff) is small 
and well-tested. Install it as a dependency.

The token storage pattern from step 2 lives in src/lib/mcp-tokens.ts. 
Follow the same pattern for new server helpers: put shared logic in 
src/lib/, route handlers stay thin.

YOUR TASK
This is step 3 of 3. You are adding troubleshooting docs and building a 
public web playground where someone can paste a git diff and get a shipping 
brief without signing up.

PART A: DOCS

1. Create or update docs/troubleshooting.md. Top-level heading: 
   "Troubleshooting Senix MCP". Add these sections in order:

   Section: "Verify your connection"
   Body: Tell the user to type this prompt into their IDE chat:
   
       List the tools from the Senix MCP server only.
   
   Expected output: the IDE should list exactly one tool, "review_changes". 
   If the IDE lists more tools or different tools, the user is connected 
   to a different MCP server. Check the server name in the config.

   Section: "Test a real review"
   Body: Tell the user to type:
   
       Use Senix to review my current uncommitted changes.
   
   Expected behavior: the IDE calls Senix and returns a shipping brief 
   within about 30 seconds. If nothing happens, the IDE did not route to 
   Senix. Check the troubleshooting list below.

   Section: "Common setup mistakes"
   Body: A plain numbered list (no dashes) with these 5 items, keeping 
   the wording consistent with the dashboard troubleshooting block:
   1. Token pasted without "Bearer " in front of it.
   2. Wrong server name. The server must be called "senix" in the config.
   3. IDE was not fully quit and reopened. Some IDEs need a full restart.
   4. Another MCP server is registered with a similar tool name and is 
      being called instead.
   5. Token was revoked or copied wrong. Generate a new one.

   Section: "Still stuck?"
   Body: One sentence telling them to email support at the project email 
   address (use a placeholder like support@senix.example if no real 
   address exists yet).

2. On the /dashboard/connect page, update the "Need help?" link added in 
   step 2 to point to the new docs page (/docs/troubleshooting or 
   wherever Next.js renders the markdown file). Keep the inline 
   troubleshooting section as a fallback below the link.

PART B: WEB PLAYGROUND

3. Add a new public page at /playground. No auth required.

   Title: "Try Senix on a real diff"
   Subtitle: "Paste a git diff. Get a shipping brief. No signup."

   The page has two columns on desktop, stacked on mobile.

   Left column: a large textarea labeled "Paste your diff here", monospace 
   font, at least 20 rows tall. Below it, a "Review with Senix" button.

   Right column: empty placeholder until the user submits. After submit, 
   show a loading state ("Reviewing your changes, this takes about 20 
   seconds"), then render the shipping brief output using the same text 
   format the MCP tool returns.

4. The submit button calls a new API endpoint POST /api/playground/review.
   The endpoint:
   
   a. Accepts a JSON body with a single field "diff" containing the 
      unified diff string.
   b. Parses the diff into the changes array shape using parse-diff. 
      For each file in the parsed diff, set file_path from the diff 
      header. If parse-diff exposes language detection use it, otherwise 
      infer language from the file extension (.js to javascript, .ts to 
      typescript, .tsx to tsx, .py to python). For new files (no "before" 
      content), set before to empty string. For deletions, set after to 
      empty string. For modifications, reconstruct before and after by 
      applying the diff hunks in reverse and forward respectively.
   c. Calls the same internal handler the review_changes MCP tool uses. 
      Do not call the MCP endpoint over HTTP, that would be wasteful. 
      Extract the analysis logic into a shared helper if it is not 
      already in src/lib/.
   d. Returns the analysis result as JSON, same shape the MCP tool 
      returns (text + structuredContent).
   
5. Rate limit /api/playground/review aggressively. Limit by IP address: 
   5 requests per IP per hour. The serverless environment means in-memory 
   counters do not work across cold starts. Use Supabase for the 
   counter. Create a new table playground_rate_limits with columns: 
   id (uuid), ip_hash (text), window_start (timestamp with time zone), 
   count (integer). Hash the IP address with sha256 before storing, do 
   not store raw IPs. The window is the current hour. On each request:
   1. Hash the IP.
   2. Look up or create a row for this ip_hash and current hour.
   3. If count >= 5, return 429 with this body:
      { "error": "Playground limit reached. Sign up for unlimited reviews." }
   4. Otherwise increment count and process the request.
   
   Use an atomic Supabase upsert with an increment expression so two 
   concurrent requests cannot both pass when the limit is at 4.

6. Also limit diff size: reject diffs larger than 50 KB before calling 
   the tool. Return 413 with this body:
   { "error": "Diff is too large for the playground. Sign up to review larger changes." }

7. Below the playground output area, after a successful review, show a 
   banner: "Like what you see? Connect Senix to your IDE for unlimited 
   reviews." with a button linking to /dashboard/connect if logged in, 
   /login if not. Detect login state with the existing session helpers.

8. Add /playground to the public landing page. Add a CTA button to the 
   hero section labeled "Try the playground". Style it as a tertiary 
   button (text link with an arrow icon, no background fill) so it does 
   not compete with the primary CTAs.

WHAT NOT TO CHANGE
Do not touch the MCP tool itself or the dashboard onboarding flow. Do 
not change billing, pricing, or existing auth logic. Do not add the 
"create table" SQL inline in code, use a Supabase migration file in the 
standard migrations location.

WHEN DONE
Tell me which files you changed or created. Confirm the rate limit works 
by describing the test you ran (6 sequential requests from the same IP, 
the 6th should return 429). If you cannot test it without a deployed 
environment, say so honestly.