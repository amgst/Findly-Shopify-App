import type { LinksFunction, LoaderFunctionArgs, MetaFunction } from "react-router";
import { Form, Link, NavLink, Outlet, useLoaderData } from "react-router";
import { requireWebAccount } from "../lib/accounts.server";
import uiStyles from "../components/ui.css?url";
import webStyles from "../components/web.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: webStyles },
  { rel: "stylesheet", href: uiStyles },
];

export const meta: MetaFunction = () => [{ title: "Dashboard – Findly" }];

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
    <div className="web w-dashboard">
      <a className="w-skip-link" href="#dashboard-content">Skip to content</a>
      <aside className="w-dash-sidebar">
        <Link to="/dashboard" className="w-logo"><span className="w-logo-mark" aria-hidden="true" />Findly</Link>
        <span className="w-workspace-label">STORE LOCATOR</span>
        <nav className="w-dash-nav" aria-label="Dashboard">
          {NAV.map(([to, label], index) => (
            <NavLink key={to} to={to} end={to === "/dashboard"}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {index === 0 ? <path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /> : index === 1 ? <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></> : index === 2 ? <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M4 10h16M10 10v10" /></> : index === 3 ? <><path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18" /></> : <path d="M4 4v16h16M8 15v-4m5 4V7m5 8v-6" />}
              </svg>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="w-dash-account">
          <span className="w-avatar" aria-hidden="true">{(name || email || "F").slice(0, 1).toUpperCase()}</span>
          <div className="w-account-copy"><strong>{name || "Your workspace"}</strong><span title={email || ""}>{email}</span></div>
          <Form method="post" action="/logout"><button type="submit" className="w-btn w-logout">Log out</button></Form>
        </div>
      </aside>
      <main id="dashboard-content" className="w-dash-main" tabIndex={-1}>
        <div className="w-dash-content"><Outlet /></div>
      </main>
    </div>
  );
}
