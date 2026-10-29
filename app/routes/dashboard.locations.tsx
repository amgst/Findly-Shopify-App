import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { requireWebAccount } from "../lib/accounts.server";
import { locationsData } from "../lib/dashboard.server";
import { handleLocatorAction } from "../lib/locations.server";
import { LocationsManager } from "../components/LocationsManager";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { locator } = await requireWebAccount(request);
  return locationsData(locator);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { locator } = await requireWebAccount(request);
  return handleLocatorAction(locator, await request.formData());
};

export default function DashboardLocations() {
  const data = useLoaderData<typeof loader>();
  return <LocationsManager {...data} isShopify={false} />;
}
