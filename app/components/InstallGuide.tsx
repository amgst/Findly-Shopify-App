import { useState } from "react";

function Snippet({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <pre className="ui-snippet">{code}</pre>
      <button
        type="button"
        className="ui-btn"
        onClick={() => {
          navigator.clipboard?.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? "Copied" : "Copy code"}
      </button>
    </div>
  );
}

const PLATFORM_STEPS: Record<string, string> = {
  wordpress: "Edit the page → add a Custom HTML block → paste the code.",
  wix: "Add → Embed Code → Embed HTML → paste the code, then resize the box.",
  squarespace: "Edit the page → add a Code block → paste the code.",
  webflow: "Drag an Embed element onto the page → paste the code.",
  other: "Paste the code into your page's HTML where the locator should appear.",
};

export function InstallGuide({
  publicId,
  origin,
  shop,
  themeEditorUrl,
}: {
  publicId: string;
  origin: string;
  shop?: string;
  themeEditorUrl?: string;
}) {
  const [platform, setPlatform] = useState("wordpress");
  const pageUrl = `${origin}/locator/${publicId}`;
  const inline = `<div id="store-locator"></div>\n<script src="${origin}/embed.js" data-locator="${publicId}" data-target="#store-locator" data-height="640px" async></script>`;
  const overlay = `<script src="${origin}/embed.js" data-locator="${publicId}" data-mode="overlay" async></script>\n\n<!-- Any link or button opens it: -->\n<a href="#store-locator">Find a store</a>`;

  return (
    <div className="ui">
      {shop && (
        <div className="ui-card">
          <h2>Add to your Shopify store</h2>
          <p className="muted">Two options, no code needed.</p>
          <div className="ui-grid ui-grid-2" style={{ marginTop: 12 }}>
            <div className="ui-card" style={{ marginBottom: 0 }}>
              <h3>1. Store locator section</h3>
              <p>
                In the theme editor, open the page where you want the map (for example a &ldquo;Stores&rdquo;
                page), click <strong>Add section</strong> and choose <strong>Store locator</strong>.
              </p>
              {themeEditorUrl && (
                <a className="ui-btn ui-btn-primary" href={themeEditorUrl} target="_top">
                  Open theme editor
                </a>
              )}
            </div>
            <div className="ui-card" style={{ marginBottom: 0 }}>
              <h3>2. Ready-made page</h3>
              <p>Your store already has a locator page. Link to it from your menu:</p>
              <p>
                <code>https://{shop}/apps/locator</code>
              </p>
              <a className="ui-btn" href={`https://${shop}/apps/locator`} target="_blank" rel="noreferrer">
                View page
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="ui-card">
        <h2>{shop ? "Embed on another website" : "Add to your website"}</h2>
        <p className="muted">Works on WordPress, Wix, Squarespace, Webflow and any site that accepts HTML.</p>
        <div className="ui-tabs" role="tablist" style={{ marginTop: 10 }}>
          {Object.keys(PLATFORM_STEPS).map((p) => (
            <button key={p} type="button" role="tab" aria-selected={platform === p} onClick={() => setPlatform(p)}>
              {p === "wordpress" ? "WordPress" : p === "other" ? "Other" : p[0].toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
        <p>{PLATFORM_STEPS[platform]}</p>

        <h3 style={{ marginTop: 16 }}>In the page</h3>
        <Snippet code={inline} />

        <h3 style={{ marginTop: 20 }}>As a pop-up</h3>
        <p className="muted small">
          Add the script once (for example in your site footer). Any link to <code>#store-locator</code> or any
          element with <code>data-pinpoint-open</code> opens the locator full-screen.
        </p>
        <Snippet code={overlay} />

        <h3 style={{ marginTop: 20 }}>Direct link</h3>
        <p>
          <a href={pageUrl} target="_blank" rel="noreferrer">
            {pageUrl}
          </a>
        </p>
        <p className="muted small">
          Developers can also read your locations as JSON from <code>{`${origin}/api/locator/${publicId}`}</code>.
        </p>
      </div>
    </div>
  );
}
