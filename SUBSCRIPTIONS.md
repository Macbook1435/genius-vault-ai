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

## Implementation added October 2026
- `api/_lib/subscriptions.js`: verifies Supabase bearer sessions, queries entitlements, reserves scan allowance.
- `api/scan.js`: when `GV_REQUIRE_SUBSCRIPTION=1`, rejects unauthenticated requests and exhausted allowances **before** AI processing.
- `api/subscription-status.js`: reports remaining allowance.
- `api/public-config.js`: supplies public Supabase anon configuration when enabled.
- `api/create-checkout.js`: creates Stripe subscription Checkout sessions only for authenticated users.
- `api/stripe-webhook.js`: verifies Stripe signatures and updates entitlements from Stripe subscription state.
- `index.html`: gated member login, signup, scan balance, and checkout controls.

## Required private Vercel environment variables (not committed)
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `GV_PUBLIC_URL`, `GV_MONTHLY_SCAN_LIMIT`.

Set `GV_REQUIRE_SUBSCRIPTION=1` **only after** Supabase schema is installed, Stripe test-mode webhook is connected to `/api/stripe-webhook`, and end-to-end tests pass. Default unset = no subscription enforcement or checkout.

## Remaining launch blockers
- Set up external Stripe and Supabase accounts, deploy SQL migration, and enter secrets.
- Test checkout, webhook, cancellation, renewal, concurrent scans, provider-credit exhaustion, and authorization.
- Implement failed-scan allowance refunds and actual per-scan token-cost accounting before charging customers. The current reservation is charged even if the AI provider fails.
- Add Stripe webhook event idempotency / event ordering protections and subscription plan change rules.
- Configure provider auto-recharge and monthly spending limits separately in the provider billing dashboard.
- Do not claim payment readiness until those tests pass.
