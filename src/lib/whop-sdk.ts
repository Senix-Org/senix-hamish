import Whop from '@whop/sdk';

/**
 * Singleton Whop API client for server-side use only. Never import this from a
 * client component: it carries the company API key and webhook signing secret.
 *
 * Notes on the constructor options:
 * - `apiKey` is the Company API Key from the Whop dashboard. It authorizes the
 *   REST calls we make (creating checkout configurations, listing memberships).
 * - `appID` is the public app id (NEXT_PUBLIC_WHOP_APP_ID).
 * - `webhookKey` is consumed by the SDK's `webhooks.unwrap()` verifier, which
 *   wraps the `standardwebhooks` library. That library expects the signing key
 *   to be base64 encoded, so we base64 encode the raw secret from the Whop
 *   Webhooks tab here. (If your WHOP_WEBHOOK_SECRET is already base64, drop the
 *   btoa wrapper.)
 */
export const whopsdk = new Whop({
  appID: process.env.NEXT_PUBLIC_WHOP_APP_ID,
  apiKey: process.env.WHOP_API_KEY,
  webhookKey: btoa(process.env.WHOP_WEBHOOK_SECRET || ''),
});
