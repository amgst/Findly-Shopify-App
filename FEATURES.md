# Location management additions

## Merchant controls

- **Products and services:** edit a location and enter comma-separated product ranges and services (up to 20 each). Customers can filter the map by product and service. These are merchant-maintained offerings, not live Shopify inventory or stock guarantees.
- **Holiday hours:** set the store's IANA time zone (for example `Asia/Karachi`), then add date-specific `Closed` or `09:00-14:00` overrides. The widget and store page show the store's local date and special hours. Weekly hours remain unchanged.
- **Bulk editing:** select location rows, choose a field, and apply a replacement value. Supports categories, products, services, all seven days' regular hours, visibility, and featured status. Other fields and special dates remain unchanged.
- **Health checks:** expand Location health to review missing coordinates, failed address lookups, incomplete addresses, missing contact methods, and possible duplicate addresses. Use the filter to show only locations needing attention. Checks do not delete or merge stores automatically.
- **Search insights:** Analytics lists searches with zero matching stores within the radius configured in Design (default 50 km). Counts are collected for new place searches. Nearest-store suggestions remain available outside that radius. Public analytics are indicative, not an authenticated source of truth.
- **Store pages:** live mapped locations have a Store page link in Locations and the widget. Pages include contact actions, products, services, regular and special hours, a copy-link button, canonical metadata, and LocalBusiness JSON-LD. Hidden locations return 404. Pages are hosted at `/stores/:publicId/:locationId` on the app domain.
- **Custom map pins:** set a default HTTPS PNG, JPEG, or WebP image in Design; individual locations can override the image and pin color. The image host must allow cross-origin browser downloads. Broken/blocked images fall back to colored circles. Icons are drawn at 36 px. Clusters keep the locator accent color.
- **Private Google Sheets:** in Import CSV > Google Sheets, choose Connect Google, then Continue to Google in a new tab. After consent, close that tab and refresh Locations. Paste the original sheet URL; use its `gid` parameter to select a tab. The connected Google account must have access to that sheet. Public/published sheets and ordinary CSV upload remain supported.

CSV import and export support `products`, `services`, `special_hours`, `timezone`, `pin_icon_url`, and `pin_color`. `special_hours` is JSON such as `{"2026-12-25":"Closed","2026-12-26":"10:00-14:00"}`. Re-syncing a CSV/Sheet replaces fields supplied by that source. Shopify location sync preserves merchant-entered offerings, special hours, and pins.

## Deployment

1. Apply the additive migration in `prisma/migrations/20261031000000_location_features` using `npx prisma migrate deploy`, then generate the client with `npx prisma generate` and deploy the app. The existing Vercel build already runs both migration and generation. Do not run the new app code against an unmigrated database.
2. For private Sheets, enable Google Sheets API in a Google Cloud project. Create a Web application OAuth client and register the exact redirect URI `https://YOUR_APP_DOMAIN/google/callback`.
3. Configure the Google OAuth consent screen and read-only scope `https://www.googleapis.com/auth/spreadsheets.readonly`. Add test users while the OAuth app is in testing. Before public merchant use, complete Google's applicable consent/verification requirements. Testing-mode grants can expire; expired/revoked grants require reconnection.
4. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_TOKEN_ENCRYPTION_KEY` in server environment settings. The encryption key must be a stable, cryptographically random secret of at least 32 characters, separate from the client secret. Keep it backed up securely; changing it requires reconnecting existing Google accounts. Never put these values in browser code or source control.
5. Set canonical `SHOPIFY_APP_URL` and a strong session signing secret (`SESSION_SECRET`, or the existing `SHOPIFY_API_SECRET`). OAuth uses the app URL's origin for the callback and signed connection link. HTTPS is required in production.

The private connection button stays unavailable until configuration is present. Refresh tokens are encrypted with AES-256-GCM, never returned by dashboard loaders or public APIs, and revoked on disconnect. Disconnect also stops scheduled sheet sync while retaining imported locations. Account deletion cascades to stored locator tokens. The app uses read-only Sheets access; it does not write to the merchant's sheet.

Google references: [web-server OAuth and offline access](https://developers.google.com/identity/protocols/oauth2/web-server), [Sheets scopes](https://developers.google.com/workspace/sheets/api/scopes), [reading cell values](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/get).

## Verification

- `node scripts/check-location-features.mjs`
- `node scripts/check-security.mjs`
- `node scripts/check-app-entry.mjs`
- `npm run typecheck`
- `npm run build`

The feature checks use mocked database/network calls and run the real widget logic in a minimal DOM. They also render the store page on the server. Live OAuth consent, real private-sheet sync, WebGL rendering, and migration against a deployed database require staging verification.
