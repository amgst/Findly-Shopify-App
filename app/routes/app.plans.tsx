import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getShopAccount } from "../lib/accounts.server";
import { getLocatorBilling } from "../lib/billing.server";
import prisma from "../db.server";
import { PlansView } from "../components/PlansView";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { locator } = await getShopAccount(session.shop);
  const params = new URL(request.url).searchParams;
  const [billing, used] = await Promise.all([
    getLocatorBilling(
      locator.id,
      params.has("plan_handle") || params.get("refresh") === "1",
      true,
    ),
    prisma.location.count({ where: { locatorId: locator.id } }),
  ]);
  return { billing, used };
};
export default function Plans() {
  const data = useLoaderData<typeof loader>();
  return (
    <s-page heading="Plans and subscription" inlineSize="large">
      <PlansView {...data} />
    </s-page>
  );
}
export const headers: HeadersFunction = (args) => boundary.headers(args);
