import type { LinksFunction, LoaderFunctionArgs, MetaFunction } from "react-router";
import { Form, Link, NavLink, Outlet, useLoaderData } from "react-router";
import { requireWebAccount } from "../lib/accounts.server";
import uiStyles from "../components/ui.css?url";
import webStyles from "../components/web.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: webStyles },
  { rel: "stylesheet", href: uiStyles },
];

export const meta: MetaFunction = () => [{ title: "Dashboard – Pinpoint" }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { account } = await requireWebAccount(request);
  return { email: account.email, name: account.name };
};

const NAV = [
  ["/dashboard", "Home"],
  ["/dashboard/locations", "Locations"],
  ["/dashboard/design", "Design"],
  ["/dashboard/install", "Install"],
  ["/dashboard/analytics", "Analytics"],
] as const;

export default function Dashboard() {
  const { email, name } = useLoaderData<typeof loader>();
  return (
    <div className="web">
      <header className="w-dash-head">
        <div className="w-container w-nav">
          <Link to="/dashboard" className="w-logo">
            <span className="w-logo-mark" aria-hidden="true" />
            Pinpoint
          </Link>
          <nav className="w-nav-links" aria-label="Dashboard">
            {NAV.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === "/dashboard"}>
                {label}
              </NavLink>
            ))}
          </nav>
          <span className="w-user w-hide-sm" title={email || ""}>
            {name || email}
          </span>
          <Form method="post" action="/logout">
            <button type="submit" className="w-btn" style={{ padding: "6px 12px", fontSize: 13 }}>
              Log out
            </button>
          </Form>
        </div>
      </header>
      <main className="w-container w-dash-main">
        <Outlet />
      </main>
    </div>
  );
}
