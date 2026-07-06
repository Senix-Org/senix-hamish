import type { Metadata } from 'next';
import {
  CodeBlock,
  DocBadge,
  DocH3,
  DocP,
  DocPageHeader,
} from '@features/shared/components/docs/doc-elements';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Risk flag reference',
  description: 'The 8 Senix risk flags, what each catches, and example triggering code.',
  path: '/docs/risk-flags',
});

type Severity = 'high' | 'medium';

type Flag = {
  name: string;
  catches: string;
  example: string;
  severity: Severity;
};

const FLAGS: Flag[] = [
  {
    name: 'sql-injection',
    catches:
      'Raw user input concatenated or interpolated into a SQL query string instead of being passed as a bound parameter.',
    example: `// Triggers sql-injection
const email = req.query.email;
db.query("SELECT * FROM users WHERE email = '" + email + "'");`,
    severity: 'high',
  },
  {
    name: 'auth-change',
    catches:
      'Addition, removal, or modification of an authentication or authorization check — sessions, tokens, role checks, or middleware guards.',
    example: `// Triggers auth-change — the admin check was removed
export function deleteUser(req, res) {
-  if (req.user.role !== 'admin') return res.status(403).end();
   db.users.delete(req.params.id);
}`,
    severity: 'high',
  },
  {
    name: 'removed-validation',
    catches:
      'Input or schema validation that previously existed has been removed or weakened. Adding new validation does not count.',
    example: `// Triggers removed-validation
export function createOrder(payload) {
-  const data = OrderSchema.parse(payload);
-  return db.orders.insert(data);
+  return db.orders.insert(payload);
}`,
    severity: 'high',
  },
  {
    name: 'hardcoded-secret',
    catches:
      'An API key, token, password, or private key written literally in source code instead of read from an environment variable or secret store.',
    example: `// Triggers hardcoded-secret
const stripe = new Stripe("live_REPLACE_WITH_YOUR_KEY");`,
    severity: 'high',
  },
  {
    name: 'new-external-api',
    catches:
      'A new outbound HTTP call to a third-party service — a fetch, axios call, or SDK call to an external host.',
    example: `// Triggers new-external-api
await fetch("https://api.analytics.io/v1/track", {
  method: "POST",
  body: JSON.stringify({ event: "signup", userId }),
});`,
    severity: 'medium',
  },
  {
    name: 'dependency-added',
    catches:
      'A new third-party package import appears that was not previously imported anywhere in the touched files.',
    example: `// Triggers dependency-added
import { format } from "date-fns";

export const stamp = () => format(new Date(), "yyyy-MM-dd");`,
    severity: 'medium',
  },
  {
    name: 'payment-logic-change',
    catches:
      'A change to code that calculates money, prices, discounts, fees, refunds, taxes, or order totals.',
    example: `// Triggers payment-logic-change
function applyDiscount(total, code) {
-  return code === "SAVE10" ? total * 0.9 : total;
+  return code === "SAVE10" ? total * 0.5 : total;
}`,
    severity: 'high',
  },
  {
    name: 'data-leak',
    catches:
      'A code path now exposes data to parties that should not see it — PII in a public endpoint, internal IDs in logs, or credentials echoed in errors.',
    example: `// Triggers data-leak — the password hash is returned to the client
app.get("/api/users/:id", async (req, res) => {
  const user = await db.users.find(req.params.id);
  res.json(user); // user includes password_hash
});`,
    severity: 'high',
  },
];

export default function RiskFlagsPage(): React.ReactElement {
  return (
    <>
      <DocPageHeader
        badge={<DocBadge>8 flags</DocBadge>}
        title="Risk flag reference"
        lead={
          <>
            Senix uses a fixed taxonomy of 8 risk flags. The model is instructed to use only
            these names and to omit a flag when nothing fits, rather than invent a new one.
          </>
        }
      />

      <DocP>
        The same taxonomy applies to both GitHub PR reviews and MCP analyses, so risk levels
        stay comparable across surfaces.
      </DocP>

      <div className="mt-10 space-y-10">
        {FLAGS.map((flag) => (
          <section
            key={flag.name}
            className="rounded-xl border border-surface-border bg-surface p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-center gap-3">
              <code className="rounded-md border border-surface-border bg-surface-raised px-2.5 py-1 font-mono text-sm text-accent">
                {flag.name}
              </code>
              <DocBadge variant={flag.severity}>
                {flag.severity} by default
              </DocBadge>
            </div>

            <DocH3>What it catches</DocH3>
            <DocP>{flag.catches}</DocP>

            <DocH3>Example</DocH3>
            <CodeBlock>{flag.example}</CodeBlock>
          </section>
        ))}
      </div>
    </>
  );
}
