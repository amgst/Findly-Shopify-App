import { MAP_THEMES } from "./settings";
import type { PublicLocator } from "./locations.server";

export const MAPLIBRE_VERSION = "4.7.1";
// Bump to bust browser caches of /widget/* after changes.
export const WIDGET_VERSION = "8";

export function appOrigin(request: Request) {
  if (process.env.SHOPIFY_APP_URL)
    return process.env.SHOPIFY_APP_URL.replace(/\/$/, "");
  const url = new URL(request.url);
  return url.origin;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** JSON that is safe to place inside a <script> tag. */
function scriptJson(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** Full HTML document for the locator (rendered inside an iframe). */
export function renderLocatorHtml(
  data: PublicLocator,
  opts: { origin: string; preview?: boolean },
) {
  const s = data.settings;
  const font =
    s.fontFamily !== "system-ui"
      ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(s.fontFamily)}:wght@400;500;600;700&display=swap">`
      : "";
  const payload = {
    ...data,
    apiBase: opts.origin,
    preview: !!opts.preview,
    themes: MAP_THEMES,
  };
  const v = WIDGET_VERSION;
  const origin = escapeHtml(opts.origin);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(s.title)}</title>
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css">
${font}
<link rel="stylesheet" href="${origin}/widget/locator.css?v=${v}">
</head>
<body>
<div id="pp-root"></div>
<script>window.__FINDLY__=${scriptJson(payload)};</script>
<script src="https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js"></script>
<script src="${origin}/widget/locator.js?v=${v}"></script>
</body>
</html>`;
}

export function htmlResponse(
  html: string,
  extraHeaders: Record<string, string> = {},
) {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Allowed to be framed anywhere: this page is designed to be embedded.
      "Content-Security-Policy": "frame-ancestors *",
      "Cache-Control": "public, max-age=60",
      ...extraHeaders,
    },
  });
}
