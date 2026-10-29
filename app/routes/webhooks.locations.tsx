// Keeps synced Shopify locations up to date (locations/create, update, delete).
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { syncShopifyLocations } from "../lib/locations.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload, admin } = await authenticate.webhook(request);
  const account = await prisma.account.findUnique({
    where: { shop },
    include: { locator: true },
  });
  const locator = account?.locator;
  if (!locator) return new Response();

  // Only auto-sync shops that have imported Shopify locations at least once.
  const synced = await prisma.location.count({ where: { locatorId: locator.id, source: "shopify" } });
  if (!synced) return new Response();

  if (topic === "LOCATIONS_DELETE") {
    const gid = (payload as { admin_graphql_api_id?: string; id?: number }).admin_graphql_api_id ||
      `gid://shopify/Location/${(payload as { id?: number }).id}`;
    await prisma.location.deleteMany({
      where: { locatorId: locator.id, source: "shopify", externalId: gid },
    });
  } else if (admin) {
    await syncShopifyLocations(admin.graphql, locator.id);
  }
  return new Response();
};
