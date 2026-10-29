import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getShopAccount } from "../lib/accounts.server";
import { designData } from "../lib/dashboard.server";
import { handleLocatorAction } from "../lib/locations.server";
import { DesignEditor } from "../components/DesignEditor";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { locator } = await getShopAccount(session.shop);
  return designData(locator);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { locator } = await getShopAccount(session.shop);
  return handleLocatorAction(locator, await request.formData());
};

export default function Design() {
  const data = useLoaderData<typeof loader>();
  return (
    <s-page heading="Design">
      <DesignEditor {...data} />
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
