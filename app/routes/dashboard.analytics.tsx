import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { requireWebAccount } from "../lib/accounts.server";
import { analyticsData } from "../lib/dashboard.server";
import { AnalyticsView } from "../components/AnalyticsView";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { locator } = await requireWebAccount(request);
  return analyticsData(locator);
};

export default function DashboardAnalytics() {
  const { stats } = useLoaderData<typeof loader>();
  return (
    <>
      <h1>Analytics</h1>
      <AnalyticsView stats={stats} />
    </>
  );
}
