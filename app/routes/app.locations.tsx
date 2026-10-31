import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getShopAccount } from "../lib/accounts.server";
import { locationsData } from "../lib/dashboard.server";
import { handleLocatorAction } from "../lib/locations.server";
import { LocationsManager } from "../components/LocationsManager";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { locator } = await getShopAccount(session.shop);
  return locationsData(locator);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const { locator } = await getShopAccount(session.shop);
  return handleLocatorAction(locator, await request.formData(), admin.graphql);
};

export default function Locations() {
  const data = useLoaderData<typeof loader>();
  return (
    <s-page inlineSize="large" heading="Locations">
      <LocationsManager {...data} isShopify />
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
