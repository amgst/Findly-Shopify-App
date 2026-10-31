import { useState } from "react";
import type {
  LinksFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from "react-router";
import { useLoaderData } from "react-router";
import { getPublicLocation } from "../lib/locations.server";
import { storeHoursToday } from "../lib/location-features";
import { appOrigin } from "../lib/widget-html.server";
import { DAYS, DAY_LABELS } from "../lib/settings";
import webStyles from "../components/web.css?url";
import uiStyles from "../components/ui.css?url";
export const links: LinksFunction = () => [
  { rel: "stylesheet", href: webStyles },
  { rel: "stylesheet", href: uiStyles },
];
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const data = await getPublicLocation(
    params.publicId || "",
    params.locationId || "",
  );
  if (!data) throw new Response("Store not found", { status: 404 });
  return {
    ...data,
    today: storeHoursToday(
      data.location.hours,
      data.location.specialHours,
      data.location.timezone,
    ),
    canonical: `${appOrigin(request)}/stores/${encodeURIComponent(data.publicId)}/${encodeURIComponent(data.location.id)}`,
  };
};
export const meta: MetaFunction<typeof loader> = ({ data }) =>
  data
    ? [
        {
          title: `${data.location.name} - ${data.location.city} | Store details`,
        },
        {
          name: "description",
          content:
            data.location.description ||
            `Visit ${data.location.name} in ${data.location.city}. Opening hours, products, services, and directions.`,
        },
        { tagName: "link", rel: "canonical", href: data.canonical },
        { property: "og:title", content: data.location.name },
        { property: "og:url", content: data.canonical },
      ]
    : [{ title: "Store not found" }, { name: "robots", content: "noindex" }];
export default function StorePage() {
  const {
    location: l,
    publicId,
    canonical,
    today,
  } = useLoaderData<typeof loader>();
  const [copied, setCopied] = useState(false);
  const specials = Object.entries(l.specialHours).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const structured = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: l.name,
    url: canonical,
    image: l.imageUrl || undefined,
    telephone: l.phone || undefined,
    email: l.email || undefined,
    description: l.description || undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: [l.address1, l.address2].filter(Boolean).join(", "),
      addressLocality: l.city,
      addressRegion: l.region,
      postalCode: l.postalCode,
      addressCountry: l.country,
    },
    geo: { "@type": "GeoCoordinates", latitude: l.lat, longitude: l.lng },
    openingHoursSpecification: DAYS.flatMap((day) => {
      const hours = String(l.hours[day] || "").match(
        /^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/,
      );
      return hours
        ? [
            {
              "@type": "OpeningHoursSpecification",
              dayOfWeek: `https://schema.org/${DAY_LABELS[day]}`,
              opens: hours[1].padStart(5, "0"),
              closes: hours[2].padStart(5, "0"),
            },
          ]
        : [];
    }),
    specialOpeningHoursSpecification: specials.map(([date, hours]) => ({
      "@type": "OpeningHoursSpecification",
      validFrom: date,
      validThrough: date,
      opens: hours.toLowerCase() === "closed" ? "00:00" : hours.split("-")[0],
      closes: hours.toLowerCase() === "closed" ? "00:00" : hours.split("-")[1],
    })),
  };
  return (
    <div className="web">
      <main
        className="w-container ui"
        style={{ paddingTop: 40, paddingBottom: 48 }}
      >
        <a href={`/locator/${publicId}`}>All locations</a>
        <div className="ui-overview-intro">
          <div>
            <span className="ui-eyebrow">STORE DETAILS</span>
            <h1>{l.name}</h1>
            <p>
              {[
                l.address1,
                l.address2,
                l.city,
                l.region,
                l.postalCode,
                l.country,
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
          <button
            type="button"
            className="ui-btn"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(canonical);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Link copied" : "Copy store link"}
          </button>
        </div>
        <div className="ui-grid ui-grid-2">
          <section className="ui-card">
            <h2>Visit this store</h2>
            {l.imageUrl && (
              <img
                src={l.imageUrl}
                alt={l.name}
                style={{
                  width: "100%",
                  maxHeight: 320,
                  objectFit: "cover",
                  borderRadius: 8,
                }}
              />
            )}
            <p>{l.description}</p>
            {l.promo && <p className="ui-banner ui-banner-info">{l.promo}</p>}
            {l.products.length > 0 && (
              <p>
                <strong>Products:</strong> {l.products.join(", ")}
              </p>
            )}
            {l.services.length > 0 && (
              <p>
                <strong>Services:</strong> {l.services.join(", ")}
              </p>
            )}
            <div className="ui-row">
              <a
                className="ui-btn ui-btn-primary"
                href={`https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lng}`}
                target="_blank"
                rel="noreferrer"
              >
                Get directions
              </a>
              {l.phone && (
                <a
                  className="ui-btn"
                  href={`tel:${l.phone.replace(/[^+\d]/g, "")}`}
                >
                  Call {l.phone}
                </a>
              )}
              {l.email && (
                <a className="ui-btn" href={`mailto:${l.email}`}>
                  Email
                </a>
              )}
              {l.website && (
                <a
                  className="ui-btn"
                  href={l.website}
                  target="_blank"
                  rel="noreferrer"
                >
                  Website
                </a>
              )}
              {l.links.map(
                (link: { label: string; url: string }, i: number) => (
                  <a
                    className="ui-btn"
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    key={i}
                  >
                    {link.label}
                  </a>
                ),
              )}
            </div>
          </section>
          <section className="ui-card">
            <h2>Opening hours</h2>
            <p className="ui-banner ui-banner-info">
              Today ({today.date}): {today.hours}
              {today.special ? " — special hours" : ""}
            </p>
            <p className="muted small">
              Store time zone: {l.timezone}. Special dates override regular
              hours.
            </p>
            <table className="ui-table">
              <tbody>
                {DAYS.map((day) => (
                  <tr key={day}>
                    <th scope="row">{DAY_LABELS[day]}</th>
                    <td>{l.hours[day] || "Not provided"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {specials.length > 0 && (
              <>
                <h3 style={{ marginTop: 24 }}>Holiday and special hours</h3>
                <table className="ui-table">
                  <tbody>
                    {specials.map(([date, hours]) => (
                      <tr key={date}>
                        <th scope="row">{date}</th>
                        <td>{hours}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structured).replace(/</g, "\\u003c"),
          }}
        />
      </main>
    </div>
  );
}
