import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { requireWebAccount } from "../lib/accounts.server";
import { appOrigin } from "../lib/widget-html.server";
import { InstallGuide } from "../components/InstallGuide";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { locator } = await requireWebAccount(request);
  return { publicId: locator.publicId, origin: appOrigin(request) };
};

export default function DashboardInstall() {
  const data = useLoaderData<typeof loader>();
  return (
    <>
      <h1>Add to your website</h1>
      <InstallGuide {...data} />
    </>
  );
}
