import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getShopAccount } from "../lib/accounts.server";
import { appOrigin } from "../lib/widget-html.server";
import { InstallGuide } from "../components/InstallGuide";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { locator } = await getShopAccount(session.shop);
  const apiKey = process.env.SHOPIFY_API_KEY || "";
  // Deep link that opens the theme editor with our app block ready to add.
  const themeEditorUrl = `https://${session.shop}/admin/themes/current/editor?template=page&addAppBlockId=${apiKey}/store_locator&target=newAppsSection`;
  return {
    publicId: locator.publicId,
    origin: appOrigin(request),
    shop: session.shop,
    themeEditorUrl,
  };
};

export default function Install() {
  const data = useLoaderData<typeof loader>();
  return (
    <s-page inlineSize="large" heading="Add to your store">
      <InstallGuide {...data} />
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
