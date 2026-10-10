# Genius Vault paid scanning — implementation status

## Built
- `database/subscription-foundation.sql`: accounts, entitlements, scan usage, row-level security, atomic allowance reservation.
- Database schema is **not deployed**. No customer checkout or subscriptions are enabled.

## Before launch (required)
1. Provision Supabase project and run migration after reviewing policies.
2. Set up Stripe products/prices and Checkout in test mode.
3. Verify Stripe webhook signatures server-side and map customer identity securely. Only trusted webhooks may set entitlements.
4. Require a verified user session on every paid scan; never trust a browser-provided user ID or scan count.
5. Reserve a scan atomically before OpenAI work; define failure/refund rules and idempotency.
6. Store actual OpenAI usage and provider costs per scan; configure operational alerts and budget caps.
7. Block scanning if customer allowance or provider credits are exhausted; do not accept payment until service is ready.
8. Test signup, failed payment, renewal, cancellation, concurrent requests, and exhausted credits.

## Security note
The current `api/scan.js` endpoint does not yet enforce customer authentication or allowances. **Do not publish paid plans until it does.** Keep Stripe and Supabase service-role keys server-side only.

## Operational note
Customer payments and OpenAI API prepaid credits are separate. Provider automatic recharge must be enabled by the business owner in OpenAI API billing settings, with appropriate limits.
