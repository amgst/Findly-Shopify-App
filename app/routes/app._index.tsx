import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getShopAccount } from "../lib/accounts.server";
import { overviewData } from "../lib/dashboard.server";
import { Overview } from "../components/Overview";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { locator } = await getShopAccount(session.shop);
  return overviewData(locator);
};

export default function Index() {
  const data = useLoaderData<typeof loader>();
  return (
    <s-page heading="Store locator">
      <Overview base="/app" {...data} />
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
