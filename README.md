# Pinpoint – store locator (Closeby alternative)

One Node app that serves three things:

| Part | URL | Who it's for |
|---|---|---|
| **Shopify app** (embedded admin) | `/app/*` | Shopify merchants, installed from the Shopify admin |
| **Web app** (signup + dashboard) | `/`, `/signup`, `/login`, `/dashboard/*` | Any website: WordPress, Wix, Squarespace, Webflow, custom |
| **Locator widget** (public) | `/locator/:id`, `/embed.js`, `/api/*` | Shoppers on the merchant's site |

Both admins share the same components and database, so every feature works in both places.

## Features

- **14 map themes** (Streets, Bright, Light, Midnight, Fiord, Satellite, Grayscale, Mono, Vintage, Pastel, Vivid, Ocean, Noir, Dusk) plus accent, text and background colors, font, and corner radius. Live preview while editing.
- **Search** by city, address or postcode, with autocomplete. Results are sorted by distance (km or miles). There's also a "use my location" button.
- **Store profiles**: photo, opening hours (today highlighted), phone, email, website, description, promo banner, and up to 4 custom buttons (UberEats, DoorDash, booking…).
- **Categories** with filter chips, featured locations, and hide/show per location.
- **Directions** button (Google Maps).
- **Map labels in 17 languages.**
- **Clustering**, so 10,000+ locations stay fast.
- **Mobile layout** with List/Map tabs.
- **Data in**: manual entry, CSV import (re-import updates rows by `id`), Google Sheets sync (hourly), and Shopify Locations sync (auto-updates via webhooks). CSV export.
- **Embed**: inline snippet, pop-up overlay (any `#store-locator` link opens it), direct link, and a JSON API.
- **Shopify storefront**: a "Store locator" theme section (app block), plus a ready-made page at `/apps/locator`.
- **Analytics**: views, searches, location views, directions and link clicks, top searches, and top locations. Events are also forwarded to Google Analytics (gtag / GTM) on the host page.
- **No map API keys**: MapLibre GL + OpenFreeMap tiles, with OpenStreetMap geocoding (Nominatim for store addresses, Photon for the search box).

## Run it locally

```bash
npm install
npm run dev          # shopify app dev – tunnels, installs on your dev store, sets env vars
```

`shopify app dev` starts the app and gives you a public tunnel URL. In that dev session:

- The Shopify admin opens from your dev store.
- The web app is at the tunnel URL root (`/signup`).

To run **only the web app** without Shopify:

```bash
npx prisma migrate deploy
npm run build
SHOPIFY_API_KEY=x SHOPIFY_API_SECRET=x SHOPIFY_APP_URL=http://localhost:3000 SESSION_SECRET=change-me npm start
```

## Environment variables

| Name | Purpose |
|---|---|
| `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SCOPES`, `SHOPIFY_APP_URL` | Set by Shopify CLI in dev. In production, set them yourself. |
| `SESSION_SECRET` | **Required in production.** Signs web-dashboard login cookies. |
| `DATABASE_URL` | Production database. Switch `prisma/schema.prisma` to `postgresql`. |
| `DEMO_LOCATOR_ID` | Optional. A locator public id to show live on the landing page. |
| `GEOCODER_NOMINATIM_URL`, `GEOCODER_PHOTON_URL`, `GEOCODER_USER_AGENT` | Optional. Use a self-hosted or paid geocoder. |
| `DISABLE_BACKGROUND_JOBS` | Set this on extra instances so only one runs geocoding and sheet sync. |

## Project layout

```
app/
  lib/                 server logic (locations, CSV, geocoding, analytics, auth, widget HTML)
  components/          shared admin UI (used by /app and /dashboard)
  routes/
    app.*              Shopify embedded admin
    dashboard.*        web dashboard
    locator.$publicId  widget page (iframe)
    api.*              public JSON, search, analytics beacon
    proxy.*            Shopify app proxy (/apps/locator)
    webhooks.*         uninstall, locations sync, GDPR
public/
  embed.js             one-line embed script (inline / overlay)
  widget/locator.js    widget UI (vanilla JS + MapLibre)
extensions/store-locator   Shopify theme app block
```

## Before going to production

- **Billing.** Plans aren't enforced yet (`Account.plan` exists). For Shopify, set up Managed Pricing in the Partner Dashboard. For the web app, add Stripe.
- **Geocoding limits.** The public Nominatim and Photon servers are fair-use only. For real traffic, use a paid provider (for example LocationIQ, MapTiler or Geoapify) or self-host, via the env vars above.
- **Satellite imagery.** It uses Esri World Imagery tiles. Check Esri's terms for commercial use, or swap in a licensed provider in `public/widget/locator.js`.
- **Hosting.** The Dockerfile works as-is. Put Postgres behind it and set `SESSION_SECRET`.
- **Web accounts.** There's no password reset or email verification yet.

## Sample data

`sample-data/bata-pakistan.csv` has 42 real Bata branches in Pakistan, taken from OpenStreetMap (© OpenStreetMap contributors, ODbL). It's for demos and may be out of date. Import it from **Locations → Import / sync → CSV file**, or from the command line:

```bash
npx tsx scripts/import-csv.ts sample-data/bata-pakistan.csv your-store.myshopify.com   # or a web account email
```
