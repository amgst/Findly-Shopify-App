// Raw locator document for the theme app block iframe: https://{shop}/apps/locator/frame
import type { LoaderFunctionArgs } from "react-router";
import { proxyLocator } from "../lib/proxy.server";
import { appOrigin, htmlResponse, renderLocatorHtml } from "../lib/widget-html.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { data } = await proxyLocator(request);
  if (!data) return new Response("Store locator is not set up yet.", { status: 404 });
  return htmlResponse(renderLocatorHtml(data, { origin: appOrigin(request) }));
};
