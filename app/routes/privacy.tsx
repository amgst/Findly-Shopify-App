import type { LinksFunction, MetaFunction } from "react-router";
import { Link } from "react-router";
import webStyles from "../components/web.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: webStyles },
];
export const meta: MetaFunction = () => [
  { title: "Privacy policy | Findly" },
  {
    name: "description",
    content:
      "How Findly handles merchant information, location data, visitor searches, Google Sheets connections, and privacy requests.",
  },
  {
    tagName: "link",
    rel: "canonical",
    href: "https://findly-store-finder.vercel.app/privacy",
  },
];

const EMAIL = "amgst99@gmail.com";
const SECTIONS = [
  ["information", "Information we handle"],
  ["use", "How we use information"],
  ["public", "Public store information"],
  ["providers", "Service providers"],
  ["google", "Google Sheets access"],
  ["choices", "Cookies and your choices"],
  ["retention", "Retention and deletion"],
  ["rights", "Privacy requests and security"],
  ["contact", "Updates and contact"],
] as const;

export default function Privacy() {
  return (
    <div className="web">
      <header className="w-container w-nav">
        <Link to="/" className="w-logo">
          <span className="w-logo-mark" aria-hidden="true" />
          Findly
        </Link>
        <nav className="w-nav-links" aria-label="Website navigation">
          <Link to="/">Home</Link>
          <a href={`mailto:${EMAIL}`}>Contact</a>
        </nav>
      </header>
      <main className="w-policy" id="main-content">
        <p className="w-policy-eyebrow">FINDLY — STORE &amp; DEALER FINDER</p>
        <h1>Privacy policy</h1>
        <p className="w-policy-date">Last updated: November 1, 2026</p>
        <p>
          This policy explains how Findly (we, us, or our) handles
          information when merchants use our app and when visitors use a store
          locator powered by Findly. It covers the Shopify app, our website and
          web dashboard, and our public locators and store pages.
        </p>
        <div className="w-policy-note">
          <strong>Questions about your data?</strong>
          <p>
            Contact <a href={`mailto:${EMAIL}`}>{EMAIL}</a> for access,
            correction, or deletion requests. If you are a shopper, include the
            store or locator you visited.
          </p>
        </div>
        <nav className="w-policy-contents" aria-label="Privacy policy contents">
          <strong>On this page</strong>
          <ol>
            {SECTIONS.map(([id, title]) => (
              <li key={id}>
                <a href={`#${id}`}>{title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <section id="information">
          <h2>1. Information we handle</h2>
          <ul>
            <li>
              <strong>Merchant accounts and installation:</strong> your Shopify
              shop domain, installation and authentication records, access
              tokens, and merchant or staff identifiers provided by Shopify. For
              a Findly web account, we store the name and email you provide and
              a password hash.
            </li>
            <li>
              <strong>Store and dealer information:</strong> names, business
              addresses and coordinates, contact details, photos or photo links,
              opening and holiday hours, products, services, categories, and
              other details you enter or import. We also store locator settings
              and connected sheet links.
            </li>
            <li>
              <strong>Locator activity:</strong> views, search text, result
              counts, viewed locations, directions and link clicks, and event
              timestamps. Search text may contain an address or other
              information a visitor enters. These events are not intentionally
              linked to Shopify customer accounts.
            </li>
            <li>
              <strong>Technical information:</strong> hosting and security
              systems may process IP addresses, request details, browser
              information, and diagnostic logs. The app uses request IP
              addresses for temporary rate limiting.
            </li>
          </ul>
          <p>
            Findly currently requests Shopify business-location access through{" "}
            <code>read_locations</code>. It does not request Shopify customer or
            order permissions. This does not mean visitor search text or
            merchant-provided information can never contain personal
            information.
          </p>
        </section>

        <section id="use">
          <h2>2. How we use information</h2>
          <p>
            We use information to authenticate merchants, display and manage
            store locators, import and synchronize locations, convert business
            addresses into map coordinates, show directions, provide usage
            reports, respond to support and privacy requests, and protect the
            service from abuse.
          </p>
          <p>
            Where applicable, processing supports providing the service
            requested by merchants, our legitimate interests in operating and
            securing it, legal obligations, or consent for optional features.
            Merchants are responsible for their own notices and any consent
            required for their use of Findly on their websites.
          </p>
        </section>

        <section id="public">
          <h2>3. Public store information</h2>
          <p>
            Information for active, mapped locations is available to visitors
            through the locator, individual store pages, and the public locator
            API. Public store pages may be indexed by search engines. Only enter
            contact details, photos, and other information you are authorized to
            publish.
          </p>
          <p>
            Merchants can edit, hide, or delete locations. Changes may take time
            to disappear from caches or search-engine results. Public sheet
            links are accessible according to their Google sharing settings;
            connecting a private sheet does not make the whole sheet public, but
            imported active store information is published through your locator.
          </p>
        </section>

        <section id="providers">
          <h2>4. Service providers and external services</h2>
          <p>
            Information is processed by the services needed to operate the app.
            These include Shopify for app authentication and store access,
            Vercel for hosting, our PostgreSQL database infrastructure, and
            Google when a merchant connects Google Sheets.
          </p>
          <p>
            Maps, address search, fonts, images, and software assets can involve
            OpenFreeMap, OpenStreetMap/Nominatim, Photon/Komoot, Google Fonts,
            the unpkg content delivery network, and the image hosts chosen by
            merchants. Satellite maps use Esri imagery. These providers may
            receive network information such as IP addresses and the map areas
            or addresses requested. Clicking directions or an external store
            link opens the relevant external service, such as Google Maps.
          </p>
          <p>
            If a merchant enables forwarding to Google Analytics or Google Tag
            Manager on their website, locator events and search terms can be
            passed to the merchant&rsquo;s analytics setup. Its privacy and consent
            settings are controlled by that merchant. We may also disclose
            information when required by law or as necessary to address fraud,
            abuse, or security incidents.
          </p>
          <p>
            Findly does not sell information collected through the app or use
            Google Sheets data for personalized advertising.
          </p>
        </section>

        <section id="google">
          <h2>5. Optional Google Sheets access</h2>
          <p>
            When you connect Google, Findly requests read-only Google Sheets
            access so it can read the spreadsheet and tab you select and keep
            your imported locations synchronized. Google&rsquo;s permission applies to
            spreadsheets your Google account can access; Findly uses it to read
            the sheet link you configure, not to browse unrelated sheets. Findly
            does not edit your spreadsheet.
          </p>
          <p>
            We store your configured sheet link, imported store information, and
            an encrypted refresh token that permits scheduled reads. Access
            tokens are used server-side and are not exposed in public locators.
            We do not use Google Sheets content to train AI models.
          </p>
          <p>
            Findly&rsquo;s use and transfer of information received from Google APIs
            will adhere to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noreferrer"
            >
              Google API Services User Data Policy
            </a>
            , including its Limited Use requirements. Google data is used for
            the disclosed import and sync functionality, not advertising, data
            brokerage, or unrelated purposes.
          </p>
          <p>
            You can choose Disconnect Google in the Google Sheets import panel
            or revoke Findly&rsquo;s access in your{" "}
            <a
              href="https://myaccount.google.com/connections"
              target="_blank"
              rel="noreferrer"
            >
              Google Account connections
            </a>
            . Disconnecting through Findly revokes the connection, removes the
            stored token, and stops scheduled sheet sync. Previously imported
            locations remain until you delete them or request deletion. Revoking
            access at Google prevents further authorized reads but does not
            itself erase information already imported into Findly.
          </p>
        </section>

        <section id="choices">
          <h2>6. Cookies, browser location, and choices</h2>
          <p>
            Findly uses a signed session cookie for web-dashboard login, with a
            maximum lifetime of 30 days, and a short-lived signed cookie for
            Google connection security. Clearing or blocking these cookies can
            affect sign-in and connections. Shopify and third-party services may
            use their own cookies.
          </p>
          <p>
            The locator can ask your browser for your location to sort nearby
            stores. You can decline or withdraw this permission in your browser
            and search manually instead. The locator&rsquo;s analytics event payload
            does not include raw browser GPS coordinates. Map requests used to
            display the selected area may still reveal an approximate area to
            map providers.
          </p>
          <p>
            Merchants can disable forwarding locator events to their website&rsquo;s
            Google Analytics in Design settings. This setting does not disable
            Findly&rsquo;s own locator activity records. Avoid entering sensitive
            personal information in the public search box.
          </p>
        </section>

        <section id="retention">
          <h2>7. Retention and deletion</h2>
          <p>
            Account, configuration, location, and analytics records remain
            stored until removed through supported app controls, an account
            deletion request, or an applicable Shopify deletion instruction. The
            30-day analytics report is a reporting window, not an automatic
            deletion deadline for underlying events.
          </p>
          <p>
            Uninstalling removes Shopify access sessions when the uninstall
            notification is processed. It does not immediately erase all stored
            store information. When Shopify sends a verified shop deletion
            request, Findly deletes the shop account and associated locator,
            locations, analytics events, and stored Google connection
            credentials.
          </p>
          <p>
            You can delete locations through the app or contact us to request
            account and associated data deletion. Limited records may need to be
            retained for legal or security reasons. Hosting logs and backup
            copies follow the relevant infrastructure provider&rsquo;s retention and
            backup processes and may not disappear at the same moment as live
            application records.
          </p>
        </section>

        <section id="rights">
          <h2>8. Privacy requests, security, and international processing</h2>
          <p>
            Depending on your location and the applicable law, you may have
            rights to request access, correction, deletion, restriction,
            objection, or a copy of personal information, and to withdraw
            consent for optional processing. You may also contact your local
            data protection authority. Send requests to{" "}
            <a href={`mailto:${EMAIL}`}>{EMAIL}</a>; we may need to verify your
            identity and relationship to the relevant account or store.
          </p>
          <p>
            For information submitted to a merchant&rsquo;s locator, the merchant may
            be responsible for the request. Contact that merchant as well, and
            we can help with information held by Findly.
          </p>
          <p>
            We use measures such as authentication, account-scoped data access,
            password hashing, and encryption of stored Google refresh tokens. No
            online service can guarantee complete security. Infrastructure
            providers can process information outside your country; applicable
            protections depend on the service and the relevant provider
            agreements.
          </p>
        </section>

        <section id="contact">
          <h2>9. Updates and contact</h2>
          <p>
            We may update this policy as the app or its data practices change.
            The date at the top identifies the latest version.
          </p>
          <p>
            <strong>Findly privacy and support:</strong>{" "}
            <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
          </p>
        </section>
      </main>
      <footer className="w-container w-footer">
        <Link to="/">Findly</Link>
        <span> · </span>
        <Link to="/privacy" aria-current="page">
          Privacy policy
        </Link>
        <span> · </span>
        <a href={`mailto:${EMAIL}`}>Contact</a>
      </footer>
    </div>
  );
}
