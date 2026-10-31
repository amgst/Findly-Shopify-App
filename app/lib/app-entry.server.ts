/** Route Shopify launches through the authenticated app, preserving launch parameters. */
export function embeddedAppEntry(request: Request): string | null {
  const url = new URL(request.url);
  const params = url.searchParams;
  const isEmbedded = params.has("shop") || params.has("host") ||
    params.get("embedded") === "1" || params.has("id_token");
  return isEmbedded ? `/app${url.search}` : null;
}
