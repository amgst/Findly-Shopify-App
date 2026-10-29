// Storefront page at https://{shop}/apps/locator, rendered inside the shop's theme.
import type { LoaderFunctionArgs } from "react-router";
import { proxyLocator } from "../lib/proxy.server";
import { appOrigin } from "../lib/widget-html.server";

function escapeAttr(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { ctx, data } = await proxyLocator(request);
  if (!data) return ctx.liquid("<p>Store locator is not set up yet.</p>");
  const src = `${appOrigin(request)}/locator/${data.id}`;
  return ctx.liquid(
    `<div class="page-width" style="padding-top:24px;padding-bottom:24px">
  <iframe src="${escapeAttr(src)}" title="${escapeAttr(data.settings.title)}" allow="geolocation"
    style="width:100%;height:min(80vh,760px);min-height:520px;border:0;display:block"></iframe>
</div>`,
  );
};
