import type { LinksFunction, LoaderFunctionArgs, MetaFunction } from "react-router";
import { redirect, Form, Link, useLoaderData } from "react-router";

import { login } from "../../shopify.server";
import { getWebAccountId } from "../../lib/accounts.server";
import webStyles from "../../components/web.css?url";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: webStyles }];

export const meta: MetaFunction = () => [
  { title: "Pinpoint – Store locator for any website and Shopify" },
  {
    name: "description",
    content:
      "Add a beautiful, on-brand store locator to Shopify, WordPress, Wix, Squarespace, Webflow or any site. No map API keys.",
  },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  // Shopify opens the app at / with ?shop=… — send it into the embedded admin.
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return {
    showShopifyForm: Boolean(login),
    signedIn: Boolean(await getWebAccountId(request)),
    demoId: process.env.DEMO_LOCATOR_ID || null,
  };
};

const FEATURES = [
  ["14 map themes", "Streets, Midnight, Satellite, Grayscale, Vintage and more — then tune colors, font and corners."],
  ["Matches your brand", "Pins, list and buttons use your colors and font automatically. No designer needed."],
  ["Instant search", "Visitors search by city, address or postcode and get results sorted by distance."],
  ["Rich store profiles", "Photos, opening hours, phone, email, promotions and custom buttons for each location."],
  ["Categories & filters", "Tag locations (Retail, Outlet, Stockist…) and let visitors filter."],
  ["Directions in one tap", "Every location links to turn-by-turn directions."],
  ["Delivery & custom links", "Add UberEats, DoorDash, booking or any call-to-action per location."],
  ["Import & sync", "Add by hand, upload CSV, sync a Google Sheet, or sync Shopify locations automatically."],
  ["Multilingual map labels", "Switch map labels between 17 languages without changing your theme."],
  ["Analytics", "See searches, top locations and directions requests — or send events to Google Analytics."],
  ["Handles 10,000+ locations", "Clustering keeps big store networks fast and readable."],
  ["No API keys", "Built on open map data. No Google Maps account, no per-view fees."],
];

export default function Landing() {
  const { showShopifyForm, signedIn, demoId } = useLoaderData<typeof loader>();

  return (
    <div className="web">
      <header className="w-container w-nav">
        <Link to="/" className="w-logo">
          <span className="w-logo-mark" aria-hidden="true" />
          Pinpoint
        </Link>
        <nav className="w-nav-links">
          <a href="#features" className="w-hide-sm">Features</a>
          <a href="#shopify" className="w-hide-sm">Shopify</a>
          {signedIn ? (
            <Link to="/dashboard" className="w-btn w-btn-primary">Dashboard</Link>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/signup" className="w-btn w-btn-primary">Start free</Link>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="w-container w-hero">
          <div>
            <h1>The store locator your brand deserves.</h1>
            <p>
              Show customers where to find you with a fast, beautiful map that matches your brand. Works with
              Shopify, WordPress, Wix, Squarespace, Webflow and any website — added with one line of code.
            </p>
            <div className="w-hero-cta">
              <Link to="/signup" className="w-btn w-btn-primary">Create your locator</Link>
              <a href="#shopify" className="w-btn">Install on Shopify</a>
            </div>
            <p className="w-hero-note">Free to start. No credit card, no map API keys.</p>
          </div>
          <div className="w-hero-demo">
            {demoId ? (
              <iframe src={`/locator/${demoId}`} title="Store locator demo" allow="geolocation" />
            ) : (
              <img
                alt=""
                src="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 320'%3E%3Crect width='400' height='320' fill='%23eef2f0'/%3E%3Crect width='140' height='320' fill='%23fff'/%3E%3Cg fill='%23e4e6e8'%3E%3Crect x='14' y='20' width='112' height='14' rx='4'/%3E%3Crect x='14' y='46' width='112' height='26' rx='6'/%3E%3Crect x='14' y='90' width='90' height='10' rx='3'/%3E%3Crect x='14' y='106' width='70' height='8' rx='3'/%3E%3Crect x='14' y='134' width='96' height='10' rx='3'/%3E%3Crect x='14' y='150' width='76' height='8' rx='3'/%3E%3C/g%3E%3Cpath d='M140 210 Q260 150 400 230' stroke='%23fff' stroke-width='10' fill='none'/%3E%3Cpath d='M250 0 L300 320' stroke='%23fff' stroke-width='8'/%3E%3Cg fill='%231f6feb' stroke='%23fff' stroke-width='3'%3E%3Ccircle cx='220' cy='120' r='9'/%3E%3Ccircle cx='310' cy='190' r='9'/%3E%3Ccircle cx='350' cy='90' r='16'/%3E%3Ccircle cx='190' cy='250' r='9'/%3E%3C/g%3E%3C/svg%3E"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            )}
          </div>
        </section>

        <section className="w-section" id="features">
          <div className="w-container">
            <h2>Everything a store locator should do</h2>
            <p>Every plan includes every theme and every feature.</p>
            <div className="w-features">
              {FEATURES.map(([title, body]) => (
                <div className="w-feature" key={title}>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="w-section">
          <div className="w-container">
            <h2>Works where your website lives</h2>
            <p>Paste one snippet in the page, or open the locator as a pop-up from any button.</p>
            <div className="w-platforms">
              {["Shopify", "WordPress", "Wix", "Squarespace", "Webflow", "Framer", "Custom HTML"].map((p) => (
                <span key={p}>{p}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="w-section" id="shopify">
          <div className="w-container w-shopify">
            <div>
              <h2>On Shopify?</h2>
              <p style={{ color: "var(--w-muted)", margin: 0 }}>
                Install the app to sync your Shopify locations, add the locator as a theme section, and get a
                ready-made <code>/apps/locator</code> page.
              </p>
            </div>
            {showShopifyForm && (
              <Form method="post" action="/auth/login">
                <input
                  className="w-input"
                  type="text"
                  name="shop"
                  placeholder="your-store.myshopify.com"
                  aria-label="Shop domain"
                />
                <button className="w-btn w-btn-primary" type="submit">
                  Install
                </button>
              </Form>
            )}
          </div>
        </section>
      </main>

      <footer className="w-container w-footer">© {new Date().getFullYear()} Pinpoint</footer>
    </div>
  );
}
