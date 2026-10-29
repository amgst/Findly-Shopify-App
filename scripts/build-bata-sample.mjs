// Builds sample-data/bata-pakistan.csv from an OpenStreetMap (Nominatim) search result.
// Usage: node scripts/build-bata-sample.mjs <nominatim-result.json>
// Data © OpenStreetMap contributors (ODbL). Branch info may be out of date.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const src = JSON.parse(readFileSync(process.argv[2], "utf8"));

const DAY = { Mo: "mon", Tu: "tue", We: "wed", Th: "thu", Fr: "fri", Sa: "sat", Su: "sun" };
const ORDER = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// Only handles the simple "Mo-Su 10:00-22:00" form; anything else is left blank.
function parseHours(oh) {
  const m = /^(Mo|Tu|We|Th|Fr|Sa|Su)-(Mo|Tu|We|Th|Fr|Sa|Su) (\d\d:\d\d-\d\d:\d\d)$/.exec(oh || "");
  if (!m) return {};
  const out = {};
  for (let i = ORDER.indexOf(m[1]); i <= ORDER.indexOf(m[2]); i++) out[DAY[ORDER[i]]] = m[3].replace("-", " – ");
  return out;
}

function cleanCity(s) {
  return (s || "")
    .replace(/^Metropolitan Corporation /, "")
    .replace(/ (Division|District|City Tehsil|Tehsil)$/, "")
    .trim();
}

const rows = src
  .filter((e) => /bata/i.test(e.name || "") && ["shop", "amenity"].includes(e.category))
  .map((e) => {
    const a = e.address || {};
    const x = e.extratags || {};
    let city = cleanCity(a.city || a.town || a.village || a.county);
    if (!city || /block|road|sector/i.test(city)) city = cleanCity(a.county || a.state_district || a.state);
    const street = [a.house_number, a.road].filter(Boolean).join(" ");
    const area = a.suburb || a.neighbourhood || a.quarter || "";
    const label = area && area !== street ? area : a.road || city;
    return {
      id: `osm-${e.osm_type?.[0] || "n"}${e.osm_id}`,
      name: `Bata – ${label}${label !== city ? `, ${city}` : ""}`,
      address: [street, area && area !== a.road ? area : ""].filter(Boolean).join(", "),
      city,
      state: a.state || "",
      postal_code: a.postcode || "",
      country: "Pakistan",
      lat: e.lat,
      lng: e.lon,
      phone: x.phone || x["contact:phone"] || "",
      website: "https://www.bata.com.pk",
      categories: "Footwear",
      hours: parseHours(x.opening_hours),
    };
  });

// Branches in the same area get the street name too, e.g. "Bata – G-9 (Rohtas Road), Islamabad".
const counts = {};
for (const r of rows) counts[r.name] = (counts[r.name] || 0) + 1;
for (const r of rows) {
  if (counts[r.name] > 1) {
    const road = r.address.split(",")[0];
    r.name = r.name.replace(/^Bata – ([^,]+)/, `Bata – $1 (${road})`);
  }
}

const header = [
  "id", "name", "address", "city", "state", "postal_code", "country", "lat", "lng", "phone", "website",
  "categories", "hours_mon", "hours_tue", "hours_wed", "hours_thu", "hours_fri", "hours_sat", "hours_sun",
];
const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const lines = [header.join(",")].concat(
  rows.map((r) =>
    [
      r.id, r.name, r.address, r.city, r.state, r.postal_code, r.country, r.lat, r.lng, r.phone, r.website,
      r.categories, ...["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => r.hours[d] || ""),
    ].map(esc).join(","),
  ),
);
mkdirSync("sample-data", { recursive: true });
writeFileSync("sample-data/bata-pakistan.csv", lines.join("\r\n") + "\r\n");
console.log(`Wrote ${rows.length} branches to sample-data/bata-pakistan.csv`);
