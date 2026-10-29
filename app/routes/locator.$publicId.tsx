// Public locator page, embedded via iframe (embed.js, Shopify theme block, or a direct link).
import type { LoaderFunctionArgs } from "react-router";
import { getPublicLocator } from "../lib/locations.server";
import { appOrigin, htmlResponse, renderLocatorHtml } from "../lib/widget-html.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const data = await getPublicLocator(params.publicId || "");
  if (!data) return new Response("Locator not found", { status: 404 });
  const preview = new URL(request.url).searchParams.get("preview") === "1";
  const html = renderLocatorHtml(data, { origin: appOrigin(request), preview });
  return htmlResponse(html, preview ? { "Cache-Control": "no-store" } : {});
};
