import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getShopAccount } from "../lib/accounts.server";
import { analyticsData } from "../lib/dashboard.server";
import { AnalyticsView } from "../components/AnalyticsView";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { locator } = await getShopAccount(session.shop);
  return analyticsData(locator);
};

export default function Analytics() {
  const { stats } = useLoaderData<typeof loader>();
  return (
    <s-page inlineSize="large" heading="Analytics">
      <AnalyticsView stats={stats} />
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
