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
  const completed = steps.filter((step) => step.done).length;
  return (
    <div className="ui">
      <div className="ui-overview-intro">
        <div><span className="ui-eyebrow">YOUR STORE LOCATOR</span><h2>Bring customers closer.</h2><p className="muted">Manage your locations, fine-tune your map, and see how customers find you.</p></div>
        <Link className="ui-btn ui-btn-primary" to={`${base}/locations`}>Manage locations</Link>
      </div>
      <div className="ui-grid ui-grid-3 ui-overview-stats">
        <div className="ui-stat">
          <div className="ui-stat-label">Locations on the map</div>
          <div className="ui-stat-value">{counts.live.toLocaleString()}</div>
          <div className="ui-stat-note">{counts.total.toLocaleString()} total locations</div>
        </div>
        <div className="ui-stat">
          <div className="ui-stat-label">Locator views (30 days)</div>
          <div className="ui-stat-value">{views30d.toLocaleString()}</div>
          <div className="ui-stat-note">Visits in the last 30 days</div>
        </div>
        <div className="ui-stat">
          <div className="ui-stat-label">Need attention</div>
          <div className="ui-stat-value" style={{ color: counts.failed ? "var(--ui-danger)" : undefined }}>
            {counts.failed.toLocaleString()}
          </div>
          <div className="ui-stat-note">{counts.failed ? "Locations to review" : "No location errors"}</div>
        </div>
      </div>

      <div className="ui-card">
        <div className="ui-card-head">
          <div><h2>{completed === steps.length ? "Setup complete" : "Get your locator ready"}</h2><p className="muted">A few simple steps to help customers find your stores.</p></div>
          <span className={`ui-pill ${completed === steps.length ? "ui-pill-ok" : ""}`}>{completed} of {steps.length} complete</span>
        </div>
        <progress className="ui-setup-progress" value={completed} max={steps.length} aria-label="Locator setup progress" />
        <div className="ui-grid">
          {steps.map((s, i) => (
            <div key={s.title} className="ui-setup-step">
              <span className={`ui-pill ${s.done ? "ui-pill-ok" : ""}`} style={{ minWidth: 28, textAlign: "center" }}>
                {s.done ? "✓" : i + 1}
              </span>
              <div className="ui-setup-copy">
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
          <div><h2>Locator preview</h2><p className="muted">See the experience your customers will use to find a store.</p></div>
          <a className="ui-btn" href={`/locator/${publicId}`} target="_blank" rel="noreferrer">
            Open in new tab
          </a>
        </div>
        <iframe
          title="Store locator"
          src={`/locator/${publicId}?preview=1`}
          allow="geolocation"
          className="ui-locator-preview"
        />
      </div>
    </div>
  );
}

