import type {
  HeadersFunction,
  LinksFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import { getShopAccount } from "../lib/accounts.server";
import { getLocatorBilling } from "../lib/billing.server";
import uiStyles from "../components/ui.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: uiStyles },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { locator } = await getShopAccount(session.shop);
  const params = new URL(request.url).searchParams;
  const billingWarning = params.has("plan_handle")
    ? (await getLocatorBilling(locator.id, true, true)).notice
    : null;

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "", billingWarning };
};

export default function App() {
  const { apiKey, billingWarning } = useLoaderData<typeof loader>();

  return (
    <AppProvider apiKey={apiKey}>
      <s-app-nav>
        {/* App nav supports rel=home; the installed generic s-link types omit it. */}
        <s-link href="/app" {...{ rel: "home" }}>
          Home
        </s-link>
        <s-link href="/app/locations">Locations</s-link>
        <s-link href="/app/design">Design</s-link>
        <s-link href="/app/install">Add to store</s-link>
        <s-link href="/app/analytics">Analytics</s-link>
        <s-link href="/app/plans">Plans</s-link>
      </s-app-nav>
      {billingWarning && (
        <div className="ui">
          <p className="ui-banner ui-banner-info" role="status">
            {billingWarning}
          </p>
        </div>
      )}
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
