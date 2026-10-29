import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { requireWebAccount } from "../lib/accounts.server";
import { overviewData } from "../lib/dashboard.server";
import { Overview } from "../components/Overview";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { locator } = await requireWebAccount(request);
  return overviewData(locator);
};

export default function DashboardHome() {
  const data = useLoaderData<typeof loader>();
  return (
    <>
      <h1>Store locator</h1>
      <Overview base="/dashboard" {...data} />
    </>
  );
}
