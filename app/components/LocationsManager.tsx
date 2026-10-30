import { useEffect, useMemo, useRef, useState } from "react";
import { useFetcher, useRevalidator } from "react-router";
import { DAYS, DAY_LABELS } from "../lib/settings";
import { toCsv } from "../lib/csv";
import { Flash, type ActionResult } from "./Flash";

export type LocationRow = {
  id: string;
  name: string;
  address1: string;
  address2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  lat: number | null;
  lng: number | null;
  geocodeStatus: string;
  phone: string;
  email: string;
  website: string;
  description: string;
  promo: string;
  imageUrl: string;
  categories: string;
  hours: string;
  links: string;
  featured: boolean;
  active: boolean;
  source: string;
  externalId: string | null;
};

type Props = {
  locations: LocationRow[];
  sheetUrl: string | null;
  sheetSyncedAt: string | Date | null;
  isShopify: boolean;
};

// Rows rendered at a time; more appear as you scroll, so big lists stay fast.
const CHUNK = 100;

function statusPill(l: LocationRow) {
  if (!l.active) return <span className="ui-pill">Hidden</span>;
  if (l.geocodeStatus === "pending") return <span className="ui-pill ui-pill-warn">Locating…</span>;
  if (l.geocodeStatus === "failed") return <span className="ui-pill ui-pill-bad">Address not found</span>;
  return <span className="ui-pill ui-pill-ok">Live</span>;
}

const SOURCE_LABEL: Record<string, string> = {
  manual: "Manual",
  csv: "CSV",
  sheet: "Google Sheet",
  shopify: "Shopify",
  demo: "Demo",
};

export function LocationsManager({ locations, sheetUrl, sheetSyncedAt, isShopify }: Props) {
  const fetcher = useFetcher<ActionResult>();
  const [editing, setEditing] = useState<LocationRow | "new" | null>(null);
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(CHUNK);
  const moreRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importTab, setImportTab] = useState<"shopify" | "csv" | "sheet" | null>(null);
  const busy = fetcher.state !== "idle";
  const intent = fetcher.formData?.get("intent");
  const demoCount = locations.filter((location) => location.source === "demo").length;

  // Close the editor after a successful save (state update during render, once per result).
  const [handled, setHandled] = useState(fetcher.data);
  if (fetcher.state === "idle" && fetcher.data !== handled) {
    setHandled(fetcher.data);
    if (fetcher.data?.ok) {
      setEditing(null);
      setSelected(new Set());
    }
  }

  // While addresses are being geocoded, refresh the list so status updates.
  const pending = locations.some((l) => l.geocodeStatus === "pending");
  const revalidator = useRevalidator();
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => revalidator.revalidate(), 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter((l) =>
      [l.name, l.address1, l.city, l.region, l.postalCode, l.country, l.categories]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [locations, query]);
  const pageRows = rows.slice(0, visible);
  const hasMore = rows.length > visible;

  // Infinite scroll: show the next chunk when the bottom of the list comes into view.
  useEffect(() => {
    const el = moreRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setVisible((v) => v + CHUNK);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, visible]);
  const failed = locations.filter((l) => l.geocodeStatus === "failed").length;

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function deleteSelected() {
    if (!confirm(`Delete ${selected.size} location(s)? This can't be undone.`)) return;
    const fd = new FormData();
    fd.set("intent", "delete_locations");
    selected.forEach((id) => fd.append("ids", id));
    fetcher.submit(fd, { method: "post" });
  }

  function exportCsv() {
    const header = [
      "id", "name", "address", "address2", "city", "state", "postal_code", "country",
      "lat", "lng", "phone", "email", "website", "categories", "description", "promo",
      "image_url", "featured", "active", ...DAYS.map((d) => `hours_${d}`),
    ];
    const data = locations.map((l) => {
      const h = safeJson<Record<string, string>>(l.hours, {});
      return [
        l.externalId || l.id, l.name, l.address1, l.address2, l.city, l.region, l.postalCode,
        l.country, l.lat, l.lng, l.phone, l.email, l.website, l.categories, l.description,
        l.promo, l.imageUrl, l.featured ? "yes" : "no", l.active ? "yes" : "no",
        ...DAYS.map((d) => h[d] || ""),
      ];
    });
    const blob = new Blob([toCsv([header, ...data])], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "locations.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="ui">
      <Flash data={fetcher.state === "idle" ? fetcher.data : undefined} />

      <section className="ui-card" aria-label="Demo data">
        <div className="ui-card-head" style={{ marginBottom: 0 }}>
          <div>
            <h2>{demoCount ? "Demo locations loaded" : "Explore with demo data"}</h2>
            <p className="muted small" style={{ marginBottom: 0 }}>
              {demoCount
                ? `${demoCount} fictional stores are visible on your locator. Remove them when you are ready to use your own locations.`
                : "Add five fictional New York stores with map pins, opening hours, and categories. They will appear on your public locator. Your existing locations will be kept."}
            </p>
          </div>
          <button
            type="button"
            className={`ui-btn ${demoCount ? "ui-btn-danger" : ""}`}
            disabled={busy}
            onClick={() => {
              if (demoCount && !confirm("Remove all demo locations, including any edits to them? Your other locations will be kept.")) return;
              fetcher.submit({ intent: demoCount ? "remove_demo" : "load_demo" }, { method: "post" });
            }}
          >
            {busy && intent === "load_demo" ? "Loading demo data..." : busy && intent === "remove_demo" ? "Removing demo data..." : demoCount ? "Remove demo data" : "Load demo data"}
          </button>
        </div>
      </section>

      <div className="ui-card ui-loc">
        <div className="ui-loc-toolbar">
          <div className="ui-loc-search">
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
              <path fill="currentColor" d="M8.5 2a6.5 6.5 0 0 1 5.18 10.43l4.45 4.44-1.42 1.42-4.44-4.45A6.5 6.5 0 1 1 8.5 2zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z" />
            </svg>
            <input
              type="search"
              placeholder="Search locations"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setVisible(CHUNK);
              }}
              aria-label="Search locations"
            />
          </div>
          <span className="ui-spacer" />
          {isShopify && (
            <button
              type="button"
              className="ui-btn ui-btn-pill"
              disabled={busy}
              onClick={() => fetcher.submit({ intent: "sync_shopify" }, { method: "post" })}
            >
              {intent === "sync_shopify" ? "Syncing…" : "Sync Shopify"}
            </button>
          )}
          <button
            type="button"
            className="ui-btn ui-btn-pill"
            disabled={busy}
            onClick={() =>
              sheetUrl
                ? fetcher.submit({ intent: "sync_sheet" }, { method: "post" })
                : setImportTab(importTab === "sheet" ? null : "sheet")
            }
            title={sheetUrl ? "Pull the latest rows from your Google Sheet" : "Connect a Google Sheet"}
          >
            {intent === "sync_sheet" ? "Syncing…" : "Sync Google Sheet"}
          </button>
          <button
            type="button"
            className="ui-btn ui-btn-pill"
            onClick={() => setImportTab(importTab === "csv" ? null : "csv")}
          >
            Import CSV
          </button>
          <button type="button" className="ui-btn ui-btn-pill" onClick={exportCsv} disabled={!locations.length}>
            Export CSV
          </button>
          <button type="button" className="ui-btn ui-btn-pill ui-btn-accent" onClick={() => setEditing("new")}>
            Add Location
          </button>
        </div>

        {importTab && (
          <ImportPanel
            key={importTab}
            initialTab={importTab}
            fetcher={fetcher}
            busyIntent={busy ? String(intent || "") : ""}
            sheetUrl={sheetUrl}
            sheetSyncedAt={sheetSyncedAt}
            isShopify={isShopify}
          />
        )}

        <div className="ui-row ui-loc-meta">
          <span className="muted small">
            {rows.length === locations.length
              ? `${locations.length} location${locations.length === 1 ? "" : "s"}`
              : `${rows.length} of ${locations.length} locations`}
            {failed > 0 && (
              <>
                {" · "}
                <span style={{ color: "var(--ui-danger)" }}>{failed} couldn&apos;t be found on the map</span>{" "}
                <button
                  type="button"
                  className="ui-btn-link ui-btn"
                  onClick={() => fetcher.submit({ intent: "retry_geocode" }, { method: "post" })}
                >
                  Retry
                </button>
              </>
            )}
            {sheetUrl && sheetSyncedAt && <> · Sheet synced {new Date(sheetSyncedAt).toLocaleString()}</>}
          </span>
          <span className="ui-spacer" />
          {selected.size > 0 && (
            <button type="button" className="ui-btn ui-btn-danger" onClick={deleteSelected} disabled={busy}>
              Delete {selected.size} selected
            </button>
          )}
        </div>

        {locations.length === 0 ? (
          <div className="ui-dropzone">
            <h3>No locations yet</h3>
            <p className="muted">Add your first store, import a CSV, or connect a Google Sheet.</p>
            <div className="ui-row" style={{ justifyContent: "center" }}>
              <button type="button" className="ui-btn ui-btn-pill ui-btn-accent" onClick={() => setEditing("new")}>
                Add Location
              </button>
              <button type="button" className="ui-btn ui-btn-pill" onClick={() => setImportTab("csv")}>
                Import CSV
              </button>
            </div>
          </div>
        ) : (
          <div className="ui-table-wrap ui-loc-table">
            <table className="ui-table">
              <thead>
                <tr>
                  <th style={{ width: 28 }}>
                    <input
                      type="checkbox"
                      aria-label="Select all shown"
                      checked={pageRows.length > 0 && pageRows.every((r) => selected.has(r.id))}
                      onChange={(e) => {
                        const next = new Set(selected);
                        pageRows.forEach((r) => (e.target.checked ? next.add(r.id) : next.delete(r.id)));
                        setSelected(next);
                      }}
                    />
                  </th>
                  <th>Name / Address</th>
                  <th>Hours</th>
                  <th>Phone</th>
                  <th>Categories</th>
                  <th style={{ textAlign: "center" }}>Images</th>
                  <th style={{ textAlign: "center" }}>Visible</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((l) => (
                  <tr key={l.id} className="ui-loc-row" onClick={() => setEditing(l)}>
                    {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${l.name}`}
                        checked={selected.has(l.id)}
                        onChange={() => toggle(l.id)}
                      />
                    </td>
                    <td className="ui-loc-name">
                      <button type="button" className="ui-loc-title" onClick={() => setEditing(l)}>
                        {l.name}
                      </button>
                      <span className="ui-loc-addr">
                        {[l.address1, l.city, [l.region, l.postalCode].filter(Boolean).join(" ")]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                      {l.featured && <span className="ui-pill ui-pill-accent">Featured</span>}
                      {(l.geocodeStatus === "pending" || l.geocodeStatus === "failed") && statusPill(l)}
                      {(l.source === "shopify" || l.source === "sheet" || l.source === "demo") && (
                        <span className="ui-loc-source">{SOURCE_LABEL[l.source] || l.source}</span>
                      )}
                    </td>
                    <td className="ui-nowrap">{hoursSummary(l.hours)}</td>
                    <td className="ui-nowrap">{l.phone || <span className="ui-dash">—</span>}</td>
                    <td className="ui-loc-cats">
                      {l.categories ? l.categories.split(",").join(" & ") : <span className="ui-dash">—</span>}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {l.imageUrl ? (
                        <img className="ui-loc-thumb" src={l.imageUrl} alt="" loading="lazy" />
                      ) : (
                        <span className="ui-dash">—</span>
                      )}
                    </td>
                    {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
                    <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className={`ui-eye ${l.active ? "is-on" : ""}`}
                        aria-pressed={l.active}
                        title={l.active ? "Shown on the map – click to hide" : "Hidden – click to show"}
                        aria-label={`${l.active ? "Hide" : "Show"} ${l.name}`}
                        onClick={() => fetcher.submit({ intent: "toggle_active", id: l.id }, { method: "post" })}
                      >
                        {l.active ? (
                          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                            <path fill="currentColor" d="M12 5c5 0 9 4.5 10 7-1 2.5-5 7-10 7S3 14.5 2 12c1-2.5 5-7 10-7zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                            <path fill="currentColor" d="M3.3 2 22 20.7 20.7 22l-3.4-3.4A11 11 0 0 1 12 19c-5 0-9-4.5-10-7a14 14 0 0 1 4-5L2 3.3zM12 5c5 0 9 4.5 10 7a13 13 0 0 1-3 4.2l-3.2-3.2A4 4 0 0 0 11 8.2L8.9 6A10 10 0 0 1 12 5zM8.1 9.4a4 4 0 0 0 6.5 4.6z" />
                          </svg>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted">
                      No locations match &ldquo;{query}&rdquo;.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {hasMore && (
          <div ref={moreRef} className="ui-loc-more">
            <button type="button" className="ui-btn" onClick={() => setVisible((v) => v + CHUNK)}>
              Show more ({rows.length - visible} left)
            </button>
          </div>
        )}
      </div>

      {editing && (
        <LocationEditor
          location={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          fetcher={fetcher}
        />
      )}
    </div>
  );
}

function safeJson<T>(s: string, def: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return def;
  }
}

// Compact open-days summary, e.g. "Sun-Mon, Wed-Sat" (week starts on Sunday).
const WEEK = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const SHORT: Record<string, string> = {
  sun: "Sun", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat",
};
function hoursSummary(json: string) {
  const h = safeJson<Record<string, string>>(json, {});
  const open = WEEK.map((d) => !!h[d] && !/^\s*closed\s*$/i.test(h[d]));
  if (!open.some(Boolean)) return <span className="ui-dash">—</span>;
  const parts: string[] = [];
  for (let i = 0; i < 7; i++) {
    if (!open[i]) continue;
    let j = i;
    while (j + 1 < 7 && open[j + 1]) j++;
    parts.push(i === j ? SHORT[WEEK[i]] : `${SHORT[WEEK[i]]}-${SHORT[WEEK[j]]}`);
    i = j;
  }
  return parts.join(", ");
}

// ------------------------------------------------------------------ import

type Fetcher = ReturnType<typeof useFetcher<ActionResult>>;

function ImportPanel({
  initialTab,
  fetcher,
  busyIntent,
  sheetUrl,
  sheetSyncedAt,
  isShopify,
}: {
  initialTab?: "shopify" | "csv" | "sheet";
  fetcher: Fetcher;
  busyIntent: string;
  sheetUrl: string | null;
  sheetSyncedAt: string | Date | null;
  isShopify: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<string>(initialTab || (isShopify ? "shopify" : "csv"));

  function uploadCsv() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("intent", "import_csv");
    fd.set("file", file);
    fetcher.submit(fd, { method: "post", encType: "multipart/form-data" });
  }

  const template =
    "data:text/csv;charset=utf-8," +
    encodeURIComponent(
      "id,name,address,city,state,postal_code,country,lat,lng,phone,email,website,categories,description,hours_mon,hours_tue,hours_wed,hours_thu,hours_fri,hours_sat,hours_sun,link_1_label,link_1_url\r\n" +
        "store-1,Downtown Store,350 5th Ave,New York,NY,10118,United States,,,+1 212 555 0100,hello@example.com,https://example.com,Retail;Outlet,Our flagship store,9:00-18:00,9:00-18:00,9:00-18:00,9:00-18:00,9:00-20:00,10:00-17:00,Closed,Order on UberEats,https://ubereats.com\r\n",
    );

  return (
    <div className="ui-card" style={{ background: "#fafbfb" }}>
      <div className="ui-tabs" role="tablist">
        {isShopify && (
          <button type="button" role="tab" aria-selected={tab === "shopify"} onClick={() => setTab("shopify")}>
            Shopify locations
          </button>
        )}
        <button type="button" role="tab" aria-selected={tab === "csv"} onClick={() => setTab("csv")}>
          CSV file
        </button>
        <button type="button" role="tab" aria-selected={tab === "sheet"} onClick={() => setTab("sheet")}>
          Google Sheets
        </button>
      </div>

      {tab === "shopify" && (
        <div>
          <p>
            Import the locations you manage in <strong>Settings → Locations</strong>. New and changed
            Shopify locations sync automatically after that. Hours, photos and links you add here are kept.
          </p>
          <button
            type="button"
            className="ui-btn ui-btn-primary"
            disabled={!!busyIntent}
            onClick={() => fetcher.submit({ intent: "sync_shopify" }, { method: "post" })}
          >
            {busyIntent === "sync_shopify" ? "Syncing…" : "Sync Shopify locations"}
          </button>
        </div>
      )}

      {tab === "csv" && (
        <div>
          <p>
            Upload a CSV with a header row. Only <code>name</code> is required; rows without{" "}
            <code>lat</code>/<code>lng</code> are placed on the map from their address. Rows with an{" "}
            <code>id</code> update existing locations on re-import.{" "}
            <a href={template} download="locations-template.csv">
              Download template
            </a>
          </p>
          <div className="ui-row">
            <input ref={fileRef} type="file" accept=".csv,text/csv" aria-label="CSV file" />
            <button type="button" className="ui-btn ui-btn-primary" disabled={!!busyIntent} onClick={uploadCsv}>
              {busyIntent === "import_csv" ? "Importing…" : "Import"}
            </button>
          </div>
        </div>
      )}

      {tab === "sheet" && (
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="save_sheet" />
          <p>
            Paste the link to a Google Sheet that uses the same columns as the CSV template, shared as
            &ldquo;Anyone with the link can view&rdquo;. It re-syncs every hour; rows you delete from the
            sheet are removed here.
          </p>
          <p className="muted small">
            The app reads sheets without signing in to Google. Allow viewers to download, or use File &gt; Share &gt; Publish to web and choose CSV.
            For a private sheet, download it as CSV and use the CSV file tab instead.
          </p>
          <div className="ui-row">
            <input
              type="url"
              name="sheetUrl"
              defaultValue={sheetUrl || ""}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              style={{ flex: 1, minWidth: 240 }}
              aria-label="Google Sheet link"
            />
            <button type="submit" className="ui-btn ui-btn-primary" disabled={!!busyIntent}>
              {busyIntent === "save_sheet" ? "Syncing…" : sheetUrl ? "Save & sync" : "Connect"}
            </button>
            {sheetUrl && (
              <button
                type="button"
                className="ui-btn"
                disabled={!!busyIntent}
                onClick={() => fetcher.submit({ intent: "sync_sheet" }, { method: "post" })}
              >
                Sync now
              </button>
            )}
          </div>
          {sheetSyncedAt && (
            <p className="muted small" style={{ marginTop: 6 }}>
              Last synced {new Date(sheetSyncedAt).toLocaleString()}
            </p>
          )}
          {sheetUrl && (
            <button type="button" className="ui-btn ui-btn-link" disabled={!!busyIntent}
              onClick={() => fetcher.submit({ intent: "save_sheet", sheetUrl: "" }, { method: "post" })}>
              Disconnect sheet (keep locations)
            </button>
          )}
        </fetcher.Form>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ editor

function LocationEditor({
  location: l,
  onClose,
  fetcher,
}: {
  location: LocationRow | null;
  onClose: () => void;
  fetcher: Fetcher;
}) {
  const hours = safeJson<Record<string, string>>(l?.hours || "{}", {});
  const links = safeJson<{ label: string; url: string }[]>(l?.links || "[]", []);
  const busy = fetcher.state !== "idle";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function copyHours(e: React.MouseEvent<HTMLButtonElement>) {
    const form = e.currentTarget.form!;
    const mon = (form.elements.namedItem("hours_mon") as HTMLInputElement).value;
    for (const d of ["tue", "wed", "thu", "fri"]) {
      (form.elements.namedItem(`hours_${d}`) as HTMLInputElement).value = mon;
    }
  }

  return (
    // Clicking the backdrop closes the drawer; Escape does the same for keyboard users.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className="ui-modal-backdrop ui" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ui-modal" role="dialog" aria-modal="true" aria-label={l ? `Edit ${l.name}` : "Add location"}>
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="save_location" />
          {l && <input type="hidden" name="id" value={l.id} />}
          <div className="ui-modal-head">
            <h2>{l ? "Edit location" : "Add location"}</h2>
            <div className="ui-row">
              <button type="button" className="ui-btn" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="ui-btn ui-btn-primary" disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
          {fetcher.data?.error && <div className="ui-banner ui-banner-error">{fetcher.data.error}</div>}
          {l?.source === "shopify" && (
            <div className="ui-banner ui-banner-info">
              Synced from Shopify. Name and address update from Shopify; your extra details are kept.
            </div>
          )}

          <div className="ui-grid">
            <label className="ui-field">
              <span>Name</span>
              <input type="text" name="name" required defaultValue={l?.name} />
            </label>
          </div>

          <div className="ui-section-title">Address</div>
          <div className="ui-grid ui-grid-2">
            <label className="ui-field">
              <span>Street address</span>
              <input type="text" name="address1" defaultValue={l?.address1} />
            </label>
            <label className="ui-field">
              <span>Apartment, suite, etc.</span>
              <input type="text" name="address2" defaultValue={l?.address2} />
            </label>
            <label className="ui-field">
              <span>City</span>
              <input type="text" name="city" defaultValue={l?.city} />
            </label>
            <label className="ui-field">
              <span>State / region</span>
              <input type="text" name="region" defaultValue={l?.region} />
            </label>
            <label className="ui-field">
              <span>Postal code</span>
              <input type="text" name="postalCode" defaultValue={l?.postalCode} />
            </label>
            <label className="ui-field">
              <span>Country</span>
              <input type="text" name="country" defaultValue={l?.country} />
            </label>
            <label className="ui-field">
              <span>Latitude</span>
              <input type="text" inputMode="decimal" name="lat" defaultValue={l?.lat ?? ""} />
            </label>
            <label className="ui-field">
              <span>Longitude</span>
              <input type="text" inputMode="decimal" name="lng" defaultValue={l?.lng ?? ""} />
              <small>Leave both blank to find them from the address.</small>
            </label>
          </div>

          <div className="ui-section-title">Contact</div>
          <div className="ui-grid ui-grid-2">
            <label className="ui-field">
              <span>Phone</span>
              <input type="tel" name="phone" defaultValue={l?.phone} />
            </label>
            <label className="ui-field">
              <span>Email</span>
              <input type="email" name="email" defaultValue={l?.email} />
            </label>
            <label className="ui-field">
              <span>Website</span>
              <input type="text" name="website" defaultValue={l?.website} placeholder="https://" />
            </label>
            <label className="ui-field">
              <span>Photo URL</span>
              <input type="text" name="imageUrl" defaultValue={l?.imageUrl} placeholder="https://" />
            </label>
          </div>

          <div className="ui-section-title">Details</div>
          <div className="ui-grid">
            <label className="ui-field">
              <span>Categories</span>
              <input type="text" name="categories" defaultValue={l?.categories} placeholder="Retail, Outlet" />
              <small>Comma separated. Visitors can filter by these.</small>
            </label>
            <label className="ui-field">
              <span>Description</span>
              <textarea name="description" rows={3} defaultValue={l?.description} />
            </label>
            <label className="ui-field">
              <span>Promotion</span>
              <input type="text" name="promo" defaultValue={l?.promo} placeholder="20% off this weekend" />
              <small>Shown as a highlighted banner on this location.</small>
            </label>
          </div>

          <div className="ui-section-title">Opening hours</div>
          <div className="ui-grid ui-grid-2">
            {DAYS.map((d) => (
              <label className="ui-field" key={d}>
                <span>{DAY_LABELS[d]}</span>
                <input type="text" name={`hours_${d}`} defaultValue={hours[d] || ""} placeholder="9:00 – 17:00 or Closed" />
              </label>
            ))}
          </div>
          <button type="button" className="ui-btn ui-btn-link" onClick={copyHours} style={{ marginTop: 6 }}>
            Copy Monday to Tue–Fri
          </button>

          <div className="ui-section-title">Buttons</div>
          <p className="muted small">Delivery or booking links, like UberEats, DoorDash or &ldquo;Book an appointment&rdquo;.</p>
          <div className="ui-grid">
            {[0, 1, 2, 3].map((i) => (
              <div className="ui-grid ui-grid-2" key={i}>
                <input type="text" name={`link_label_${i}`} defaultValue={links[i]?.label} placeholder="Button label" aria-label={`Button ${i + 1} label`} />
                <input type="text" name={`link_url_${i}`} defaultValue={links[i]?.url} placeholder="https://" aria-label={`Button ${i + 1} link`} />
              </div>
            ))}
          </div>

          <div className="ui-section-title">Visibility</div>
          <div className="ui-grid">
            <label className="ui-check">
              <input type="checkbox" name="active" defaultChecked={l ? l.active : true} /> Show on the map
            </label>
            <label className="ui-check">
              <input type="checkbox" name="featured" defaultChecked={l?.featured} /> Featured (listed first)
            </label>
          </div>

          {l && (
            <div style={{ marginTop: 24 }}>
              <button
                type="button"
                className="ui-btn ui-btn-danger"
                onClick={() => {
                  if (!confirm(`Delete ${l.name}?`)) return;
                  const fd = new FormData();
                  fd.set("intent", "delete_locations");
                  fd.append("ids", l.id);
                  fetcher.submit(fd, { method: "post" });
                }}
              >
                Delete location
              </button>
            </div>
          )}
        </fetcher.Form>
      </div>
    </div>
  );
}
