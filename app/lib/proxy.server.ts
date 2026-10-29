// Shopify App Proxy: storefront /apps/locator/* is forwarded here (see shopify.app.toml).
import { authenticate } from "../shopify.server";
import { getShopAccount } from "./accounts.server";
import { getPublicLocator } from "./locations.server";

export async function proxyLocator(request: Request) {
  // Verifies Shopify's HMAC signature; throws a 400 if the request didn't come from Shopify.
  const ctx = await authenticate.public.appProxy(request);
  const shop = ctx.session?.shop || new URL(request.url).searchParams.get("shop");
  if (!shop) return { ctx, data: null };
  const { locator } = await getShopAccount(shop);
  return { ctx, data: await getPublicLocator(locator.publicId) };
}
