import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { FONTS, MAP_LANGUAGES, MAP_THEMES, type LocatorSettings } from "../lib/settings";
import { Flash, type ActionResult } from "./Flash";

// Rough swatches so merchants can tell themes apart at a glance.
const SWATCH: Record<string, string> = {
  streets: "linear-gradient(135deg,#f2efe9 55%,#aad3df 55%)",
  bright: "linear-gradient(135deg,#f8f4f0 55%,#9fd3f0 55%)",
  light: "linear-gradient(135deg,#fafaf8 55%,#d4dadc 55%)",
  midnight: "linear-gradient(135deg,#2b2b2b 55%,#0f1a24 55%)",
  fiord: "linear-gradient(135deg,#45516e 55%,#38435c 55%)",
  satellite: "linear-gradient(135deg,#5b6b3a 45%,#1f3b4d 45%)",
  grayscale: "linear-gradient(135deg,#f4f4f4 55%,#cfcfcf 55%)",
  mono: "linear-gradient(135deg,#ececec 55%,#bdbdbd 55%)",
  vintage: "linear-gradient(135deg,#efe3cc 55%,#c9b99a 55%)",
  pastel: "linear-gradient(135deg,#f7f2ee 55%,#c3e1ee 55%)",
  vivid: "linear-gradient(135deg,#fff3e0 55%,#58c2f5 55%)",
  ocean: "linear-gradient(135deg,#e7f1f5 55%,#6fa9c4 55%)",
  noir: "linear-gradient(135deg,#1c1c1c 55%,#050505 55%)",
  dusk: "linear-gradient(135deg,#5a4e6e 55%,#3d3552 55%)",
};

export function DesignEditor({
  settings: initial,
  publicId,
}: {
  settings: LocatorSettings;
  publicId: string;
}) {
  const fetcher = useFetcher<ActionResult>();
  const [s, setS] = useState<LocatorSettings>(initial);
  const frame = useRef<HTMLIFrameElement>(null);
  const dirty = JSON.stringify(s) !== JSON.stringify(initial);

  // Push every change to the preview iframe without reloading it.
  useEffect(() => {
    frame.current?.contentWindow?.postMessage({ type: "findly:settings", settings: s }, "*");
  }, [s]);

  function set<K extends keyof LocatorSettings>(k: K, v: LocatorSettings[K]) {
    setS((prev) => ({ ...prev, [k]: v }));
  }

  function save() {
    const fd = new FormData();
    fd.set("intent", "save_settings");
    for (const [k, v] of Object.entries(s)) {
      if (typeof v === "boolean") {
        if (v) fd.set(k, "on");
      } else fd.set(k, String(v));
    }
    fetcher.submit(fd, { method: "post" });
  }

  return (
    <div className="ui">
      <Flash data={fetcher.state === "idle" ? fetcher.data : undefined} />
      <div className="ui-design">
        <div>
          <div className="ui-card">
            <div className="ui-card-head">
              <h2>Map theme</h2>
            </div>
            <div className="ui-themes">
              {MAP_THEMES.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  className="ui-theme"
                  aria-pressed={s.theme === t.id}
                  onClick={() => set("theme", t.id)}
                >
                  <div className="ui-theme-swatch" style={{ background: SWATCH[t.id] }} />
                  {t.name}
                </button>
              ))}
            </div>
            <label className="ui-field" style={{ marginTop: 12 }}>
              <span>Map label language</span>
              <select value={s.language} onChange={(e) => set("language", e.target.value)}>
                {MAP_LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="ui-card">
            <h2 style={{ marginBottom: 12 }}>Brand</h2>
            <div className="ui-grid">
              <div className="ui-grid ui-grid-3">
                {(
                  [
                    ["primaryColor", "Accent"],
                    ["textColor", "Text"],
                    ["backgroundColor", "Background"],
                  ] as const
                ).map(([k, label]) => (
                  <label className="ui-field" key={k}>
                    <span>{label}</span>
                    <span className="ui-row">
                      <input type="color" value={s[k]} onChange={(e) => set(k, e.target.value)} />
                      <code className="small">{s[k]}</code>
                    </span>
                  </label>
                ))}
              </div>
              <label className="ui-field">
                <span>Font</span>
                <select value={s.fontFamily} onChange={(e) => set("fontFamily", e.target.value)}>
                  {FONTS.map((f) => (
                    <option key={f} value={f}>
                      {f === "system-ui" ? "System default" : f}
                    </option>
                  ))}
                </select>
                <small>Font changes show in the preview after saving.</small>
              </label>
              <label className="ui-field">
                <span>Corner roundness: {s.borderRadius}px</span>
                <input
                  type="range"
                  min={0}
                  max={24}
                  value={s.borderRadius}
                  onChange={(e) => set("borderRadius", Number(e.target.value))}
                />
              </label>
            </div>
          </div>

          <div className="ui-card">
            <h2 style={{ marginBottom: 12 }}>Layout & text</h2>
            <div className="ui-grid">
              <label className="ui-field">
                <span>Heading</span>
                <input type="text" value={s.title} onChange={(e) => set("title", e.target.value)} />
              </label>
              <label className="ui-field">
                <span>Search placeholder</span>
                <input
                  type="text"
                  value={s.searchPlaceholder}
                  onChange={(e) => set("searchPlaceholder", e.target.value)}
                />
              </label>
              <div className="ui-grid ui-grid-2">
                <label className="ui-field">
                  <span>List position</span>
                  <select
                    value={s.listPosition}
                    onChange={(e) => set("listPosition", e.target.value as "left" | "right")}
                  >
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </label>
                <label className="ui-field">
                  <span>Distance units</span>
                  <select value={s.units} onChange={(e) => set("units", e.target.value as "km" | "mi")}>
                    <option value="km">Kilometers</option>
                    <option value="mi">Miles</option>
                  </select>
                </label>
              </div>
              <label className="ui-check">
                <input
                  type="checkbox"
                  checked={s.showCategoryFilter}
                  onChange={(e) => set("showCategoryFilter", e.target.checked)}
                />
                Show category filter
              </label>
              <label className="ui-check">
                <input
                  type="checkbox"
                  checked={s.showDirections}
                  onChange={(e) => set("showDirections", e.target.checked)}
                />
                Show &ldquo;Directions&rdquo; button
              </label>
            </div>
          </div>

          <div className="ui-card">
            <h2 style={{ marginBottom: 12 }}>Starting position</h2>
            <div className="ui-grid">
              <label className="ui-field">
                <span>When the map opens</span>
                <select
                  value={s.initialView}
                  onChange={(e) => set("initialView", e.target.value as "fit" | "fixed")}
                >
                  <option value="fit">Zoom to show all locations</option>
                  <option value="fixed">Start at a fixed position</option>
                </select>
              </label>
              {s.initialView === "fixed" && (
                <div className="ui-grid ui-grid-3">
                  <label className="ui-field">
                    <span>Latitude</span>
                    <input
                      type="number"
                      step="any"
                      value={s.defaultLat}
                      onChange={(e) => set("defaultLat", Number(e.target.value))}
                    />
                  </label>
                  <label className="ui-field">
                    <span>Longitude</span>
                    <input
                      type="number"
                      step="any"
                      value={s.defaultLng}
                      onChange={(e) => set("defaultLng", Number(e.target.value))}
                    />
                  </label>
                  <label className="ui-field">
                    <span>Zoom (1–18)</span>
                    <input
                      type="number"
                      min={1}
                      max={18}
                      value={s.defaultZoom}
                      onChange={(e) => set("defaultZoom", Number(e.target.value))}
                    />
                  </label>
                </div>
              )}
              <label className="ui-check">
                <input
                  type="checkbox"
                  checked={s.useVisitorLocation}
                  onChange={(e) => set("useVisitorLocation", e.target.checked)}
                />
                Center on the visitor if they&apos;ve already shared their location
              </label>
            </div>
          </div>

          <div className="ui-card">
            <h2 style={{ marginBottom: 12 }}>Analytics</h2>
            <label className="ui-check">
              <input
                type="checkbox"
                checked={s.googleAnalytics}
                onChange={(e) => set("googleAnalytics", e.target.checked)}
              />
              Send events to Google Analytics on my site
            </label>
            <p className="muted small" style={{ marginTop: 6 }}>
              Sends store_locator_search, store_locator_location_view and store_locator_directions
              events to gtag or the GTM dataLayer.
            </p>
          </div>
        </div>

        <div className="ui-design-preview">
          <div className="ui-row" style={{ marginBottom: 10 }}>
            <strong>Live preview</strong>
            <span className="ui-spacer" />
            {dirty && <span className="muted small">Unsaved changes</span>}
            <button type="button" className="ui-btn" disabled={!dirty} onClick={() => setS(initial)}>
              Reset
            </button>
            <button
              type="button"
              className="ui-btn ui-btn-primary"
              disabled={!dirty || fetcher.state !== "idle"}
              onClick={save}
            >
              {fetcher.state !== "idle" ? "Saving…" : "Save"}
            </button>
          </div>
          <iframe
            ref={frame}
            title="Store locator preview"
            src={`/locator/${publicId}?preview=1`}
            allow="geolocation"
            onLoad={() =>
              frame.current?.contentWindow?.postMessage({ type: "findly:settings", settings: s }, "*")
            }
          />
        </div>
      </div>
    </div>
  );
}
