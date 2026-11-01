import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { billingReady, planSelectionUrl } from "../lib/billing.server";
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, redirect } = await authenticate.admin(request);
  const url = planSelectionUrl(session.shop);
  if (!billingReady() || !url)
    return new Response(
      "Subscription setup is not complete. You can continue using Free. Contact support for help.",
      { status: 503 },
    );
  return redirect(url, { target: "_top" });
};
export const headers: HeadersFunction = (args) => boundary.headers(args);
