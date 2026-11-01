# Shopify App Pricing setup

Findly uses Shopify App Pricing and the Partner API's current `activeSubscription` contract. It does not create Admin Billing API charges. Merchants approve any paid subscription on Shopify's hosted plan-selection page.

| Exact plan handle | Display name | Monthly price configured in Shopify | Saved locations |
| --- | --- | --- | --- |
| `free` | Free | Free | 10 |
| `starter` | Starter | $5 | 50 |
| `pro` | Pro | $9 | Unlimited |

Keep the paid plans' 10-day trials in Shopify. Trial eligibility, charges, and discounts are controlled by Shopify, not calculated by Findly. The app's display prices are in `app/lib/plans.ts`; keep them aligned with the published Shopify plans. Unlimited means no plan-level location count cap; individual CSV and sheet requests still have size/row safety limits.

## Required server configuration

Set these values locally and in Vercel's production environment. Never expose the access token in browser code, screenshots, support messages, or source control.

- `SHOPIFY_PARTNER_ORG_ID`: numeric Partner ID from `https://partners.shopify.com/{partner_id}/...`. The organization ID in a `dev.shopify.com/dashboard/{organization_id}/...` URL is different and must not be substituted.
- `SHOPIFY_PARTNER_API_ACCESS_TOKEN`: create a Partner API client with **Manage apps** permission in Dev Dashboard > Organization settings > Users > Security > Partner API clients. Store the token securely in server environment settings.
- `SHOPIFY_APP_GID`: `gid://shopify/App/441377488897`, based on the supplied Findly app URL. This is the numeric app ID, not the OAuth client ID in `shopify.app.toml`.
- `SHOPIFY_APP_HANDLE`: the app handle used in `https://admin.shopify.com/store/{store}/charges/{app_handle}/pricing_plans`. Copy it from the app's plan-selection URL or configured app handle; don't infer it from the display name or Vercel domain.

Without Partner credentials, existing Free access stays available, paid upgrades are not offered, and no paid limit is unlocked. Missing/broken credentials after a previously verified paid subscription do not silently downgrade that merchant; new additions require a successful verification.

## Deployment and plan activation

1. Apply the `20261101000000_verified_pricing` and `20261101000100_billing_revision` migrations using `npx prisma migrate deploy`, generate the Prisma client, and deploy the app. Vercel's existing build script runs migration and generation. The migration adds verification metadata; it does not delete locations or change existing subscriptions.
2. Set each plan's welcome/redirect URL to `/app/plans?refresh=1` in Shopify. Older `/app` or root welcome links containing `plan_handle` are also handled, but the Plans page gives merchants an immediate verification result.
3. Confirm the exact handles are `free`, `starter`, and `pro`. Update Pro's listing/plan feature description to **Unlimited locations**. Leave usage charges empty for these fixed-price subscriptions.
4. Test the draft plans on a development store, including paid trial access and each approval/return flow. In Findly, open Plans > Manage subscription in Shopify; after approval, return to Findly and check the limit shown in Locations. Use Refresh subscription if needed.
5. Test Free → Starter, Starter → Pro, a scheduled downgrade/cancellation, trial expiry, and uninstall/reinstall. Verify the current Partner API contract, not just the redirect URL. Confirm a failure to reach Shopify shows a verification notice and does not unlock a new paid allowance.
6. Only after those live tests succeed, complete Shopify's readiness checklist and enable Shopify App Pricing. Code changes alone do not enable pricing or publish draft plans.

## Access behavior

- The app looks up the authenticated store's GID through the Admin API, then queries the Partner API with that GID and the configured app GID.
- Only recognized plan handles in the **current** recurring subscription grant access. Pending plan changes and browser query parameters never grant early access. Unknown plans or mismatched shops fail verification.
- Active trials receive their verified plan's allowance. A scheduled cancellation retains current access until Shopify ends the contract. A confirmed missing contract restores Free access.
- Confirmed subscriptions are cached in the database for at most five minutes, with earlier refresh at trial/billing boundaries. Explicit refresh and plan-selection returns force a check. Partner API throttling or network failures don't overwrite a previously verified plan or authorize new additions on stale access. Multiple server instances can still be throttled by the Partner API; failures are safe and retryable.
- Uninstall invalidates the cache and increments a revision so a delayed pre-uninstall response cannot restore the old entitlement after reinstall.
- All manual additions, CSV imports, sheet syncs, Shopify syncs, and demo additions use the verified limit under the existing PostgreSQL write lock. Pure updates remain allowed during temporary verification failures. Standalone web accounts use Free; Shopify subscriptions do not upgrade unrelated web accounts.
- Existing records are not deleted or hidden after a downgrade. If their count exceeds the new limit, merchants can edit, export, or remove them but cannot add more until they free space or upgrade. Existing public location pages remain available.

## Checks completed locally

- `node scripts/check-billing.mjs`: mocked Partner API contracts, upgrades, trials, scheduled cancellation, cancellation/freeze represented by no active contract, forced refresh, cache expiry, wrong shops, unknown plans, API errors, uninstall races, and server-rendered pricing UI.
- `node scripts/check-location-limit.mjs`: transaction-scoped Free/Starter limits and unlimited Pro across location write paths.
- Existing feature, security, and app-entry regression checks, TypeScript, lint, and production build.

These tests do not create or charge a real subscription. Live draft-plan verification and activation remain pending until the Partner settings are provided.

References: [Shopify App Pricing](https://shopify.dev/docs/apps/launch/billing/shopify-app-pricing), [subscription checks and iframe-safe redirects](https://shopify.dev/docs/apps/launch/billing/shopify-app-pricing/redirect-plan-selection-page), [Partner API authentication](https://shopify.dev/docs/api/partner/latest#authentication).
