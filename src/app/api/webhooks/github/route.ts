import { NextRequest, NextResponse } from 'next/server';
   import { verifyGithubSignature } from '@/lib/github-webhook';
   import { supabaseAdmin } from '@/lib/supabase';
   import { routeEvent } from '@/server/handlers';
   
   export const runtime = 'nodejs';
   export const dynamic = 'force-dynamic';
   
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
   
     let payload: any = {};
     try {
       payload = JSON.parse(rawBody);
     } catch {
       payload = { _parseError: true };
     }
   
     // Always log the event
     await supabaseAdmin.from('webhook_events').insert({
       github_delivery_id: deliveryId,
       event_type: eventType,
       action: payload?.action ?? null,
       payload,
       signature_valid: valid,
     });
   
     if (!valid) {
       return NextResponse.json(
         { error: 'Invalid signature' },
         { status: 401 }
       );
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
     await supabaseAdmin
       .from('webhook_events')
       .update({ processed: true })
       .eq('github_delivery_id', deliveryId);
   
     return NextResponse.json({ ok: true, result });
   }
   
   export async function GET() {
     return NextResponse.json({ status: 'ready' });
   }