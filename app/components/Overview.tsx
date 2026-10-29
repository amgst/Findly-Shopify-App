import { Link } from "react-router";

export function Overview({
  base,
  counts,
  views30d,
  everViewed,
  customized,
  publicId,
}: {
  base: string;
  counts: { total: number; live: number; failed: number };
  views30d: number;
  everViewed: boolean;
  customized: boolean;
  publicId: string;
}) {
  const isShopify = base === "/app";
  const steps = [
    { done: counts.total > 0, title: "Add your locations", body: "Add stores by hand, import a CSV or connect a Google Sheet.", to: `${base}/locations`, cta: "Manage locations" },
    { done: customized, title: "Match your brand", body: "Pick a map theme, colors and font.", to: `${base}/design`, cta: "Customize design" },
    {
      done: everViewed,
      title: "Put it on your site",
      body: everViewed
        ? "Your locator is live and getting visitors."
        : isShopify
          ? "Add the \u201cStore locator\u201d section in your theme editor, or link to /apps/locator. This turns green after the first visit to your live store page."
          : "Paste the embed code on your website. This turns green after the first visit to your live page.",
      to: `${base}/install`,
      cta: everViewed ? "View options" : "Install",
    },
  ];
  return (
    <div className="ui">
      <div className="ui-grid ui-grid-3" style={{ marginBottom: 16 }}>
        <div className="ui-stat">
          <div className="ui-stat-label">Locations on the map</div>
          <div className="ui-stat-value">{counts.live}</div>
        </div>
        <div className="ui-stat">
          <div className="ui-stat-label">Locator views (30 days)</div>
          <div className="ui-stat-value">{views30d.toLocaleString()}</div>
        </div>
        <div className="ui-stat">
          <div className="ui-stat-label">Need attention</div>
          <div className="ui-stat-value" style={{ color: counts.failed ? "var(--ui-danger)" : undefined }}>
            {counts.failed}
          </div>
        </div>
      </div>

      <div className="ui-card">
        <h2 style={{ marginBottom: 12 }}>Get set up</h2>
        <div className="ui-grid">
          {steps.map((s, i) => (
            <div key={s.title} className="ui-row" style={{ alignItems: "flex-start", gap: 12 }}>
              <span className={`ui-pill ${s.done ? "ui-pill-ok" : ""}`} style={{ minWidth: 28, textAlign: "center" }}>
                {s.done ? "✓" : i + 1}
              </span>
              <div style={{ flex: 1 }}>
                <strong>{s.title}</strong>
                <p className="muted" style={{ margin: 0 }}>{s.body}</p>
              </div>
              <Link className="ui-btn" to={s.to}>
                {s.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card-head">
          <h2>Your locator</h2>
          <a className="ui-btn" href={`/locator/${publicId}`} target="_blank" rel="noreferrer">
            Open in new tab
          </a>
        </div>
        <iframe
          title="Store locator"
          src={`/locator/${publicId}?preview=1`}
          allow="geolocation"
          style={{ width: "100%", height: 480, border: "1px solid var(--ui-line)", borderRadius: 10 }}
        />
      </div>
    </div>
  );
}
