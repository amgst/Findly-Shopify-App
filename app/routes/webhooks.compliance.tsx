// Mandatory privacy webhooks for App Store apps.
// The app stores no customer personal data, so only shop/redact needs to delete anything.
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  if (topic === "SHOP_REDACT") {
    // Cascades to locator, locations and analytics events.
    await prisma.account.deleteMany({ where: { shop } });
    await prisma.session.deleteMany({ where: { shop } });
  }
  return new Response();
};
