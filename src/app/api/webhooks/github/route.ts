import { NextRequest, NextResponse } from 'next/server';
   import { verifyGithubSignature } from '@features/webhook/signature';
   import { routeEvent } from '@features/webhook/route-event';
   import { claimDelivery, markDeliveryProcessed } from '@features/webhook/idempotency';

   export const runtime = 'nodejs';
   export const dynamic = 'force-dynamic';
   // The PR analysis runs in an after() callback dispatched from this route.
   // On Cloudflare Workers there is no wall-clock cap (billing is CPU time),
   // so no maxDuration is needed; the LLM wait costs almost no CPU.

   export async function POST(req: NextRequest) {
     const rawBody = await req.text();
     const signature = req.headers.get('x-hub-signature-256');
     const deliveryId = req.headers.get('x-github-delivery');
     const eventType = req.headers.get('x-github-event');
   
     if (!deliveryId || !eventType) {
       return NextResponse.json(
         { error: 'Missing required GitHub headers' },
         { status: 400 }
       );
     }
   
     const secret = process.env.GITHUB_WEBHOOK_SECRET!;
     const valid = verifyGithubSignature(rawBody, signature, secret);

     // Reject BEFORE any database write. Logging unverified payloads would
     // let any anonymous caller create webhook_events rows (storage abuse).
     if (!valid) {
       return NextResponse.json(
         { error: 'Invalid signature' },
         { status: 401 }
       );
     }

     let payload: any = {};
     try {
       payload = JSON.parse(rawBody);
     } catch {
       payload = { _parseError: true };
     }

     // Log the event AND claim the delivery id in one atomic insert. Only
     // verified deliveries reach this point. github_delivery_id is UNIQUE,
     // so when GitHub retries a delivery (even concurrently) exactly one
     // request inserts the row and proceeds; the rest see the conflict and
     // dedupe, so a retry can never produce a duplicate analysis or comment.
     const claim = await claimDelivery({
       deliveryId,
       eventType,
       action: payload?.action ?? null,
       payload,
     });
     if (claim === 'duplicate') {
       return NextResponse.json({ ok: true, deduped: true });
     }

     // Route to handler. Always return 200 to GitHub even if handler throws —
     // we don't want GitHub to retry endlessly on bugs in our code.
     let result = 'unrouted';
     try {
       result = await routeEvent(eventType, payload);
     } catch (err: any) {
       console.error('[handler error]', eventType, err.message);
       result = `error:${err.message}`;
     }
   
     // Mark the event as processed
     await markDeliveryProcessed(deliveryId);

     return NextResponse.json({ ok: true, result });
   }
   
   export async function GET() {
     return NextResponse.json({ status: 'ready' });
   }