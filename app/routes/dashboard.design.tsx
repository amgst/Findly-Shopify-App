import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { requireWebAccount } from "../lib/accounts.server";
import { designData } from "../lib/dashboard.server";
import { handleLocatorAction } from "../lib/locations.server";
import { DesignEditor } from "../components/DesignEditor";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { locator } = await requireWebAccount(request);
  return designData(locator);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { locator } = await requireWebAccount(request);
  return handleLocatorAction(locator, await request.formData());
};

export default function DashboardDesign() {
  const data = useLoaderData<typeof loader>();
  return (
    <>
      <h1>Design</h1>
      <DesignEditor {...data} />
    </>
  );
}
