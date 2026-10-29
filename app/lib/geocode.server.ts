// Geocoding via OpenStreetMap services (no API key).
//  - Store addresses: Nominatim (max 1 request/second, per its usage policy).
//  - Visitor search box: Photon (fast autocomplete).
// Override with GEOCODER_NOMINATIM_URL / GEOCODER_PHOTON_URL to use a self-hosted instance.
import prisma from "../db.server";

const NOMINATIM =
  process.env.GEOCODER_NOMINATIM_URL || "https://nominatim.openstreetmap.org";
const PHOTON = process.env.GEOCODER_PHOTON_URL || "https://photon.komoot.io";
const USER_AGENT =
  process.env.GEOCODER_USER_AGENT ||
  `PinpointStoreLocator/1.0 (${process.env.SHOPIFY_APP_URL || "localhost"})`;

let lastNominatimCall = 0;
let chain: Promise<unknown> = Promise.resolve();

/** Serialize Nominatim calls so we never exceed 1 req/sec. */
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = async () => {
    const wait = Math.max(0, lastNominatimCall + 1100 - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastNominatimCall = Date.now();
    return fn();
  };
  const p = chain.then(run, run);
  chain = p.catch(() => undefined);
  return p;
}

export function addressString(l: {
  address1?: string;
  address2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
}) {
  return [l.address1, l.city, l.region, l.postalCode, l.country]
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .join(", ");
}

export async function geocodeAddress(
  query: string,
): Promise<{ lat: number; lng: number } | null> {
  if (!query.trim()) return null;
  return throttled(async () => {
    const url = `${NOMINATIM}/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;
    const data = (await res.json()) as { lat: string; lon: string }[];
    if (!data[0]) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  });
}

export type SearchResult = { label: string; lat: number; lng: number };

const searchCache = new Map<string, { at: number; results: SearchResult[] }>();

export async function searchPlaces(
  q: string,
  lang?: string,
): Promise<SearchResult[]> {
  const key = `${lang || ""}|${q.toLowerCase().trim()}`;
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.at < 24 * 3600_000) return hit.results;

  const params = new URLSearchParams({ q, limit: "8" });
  // Photon only translates to these; otherwise use English rather than local script.
  params.set("lang", lang && ["en", "de", "fr", "it"].includes(lang) ? lang : "en");
  const res = await fetch(`${PHOTON}/api/?${params}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    features: {
      geometry: { coordinates: [number, number] };
      properties: Record<string, string>;
    }[];
  };
  // Prefer areas (cities, neighbourhoods, postcodes, streets) over businesses like hotels,
  // so "Gulberg Lahore" goes to the Gulberg area rather than a hotel named Gulberg.
  const rank = (p: Record<string, string>) =>
    p.osm_key === "place" || p.osm_key === "boundary" ? 0 : p.osm_key === "highway" ? 1 : 2;
  const features = [...data.features].sort((a, b) => rank(a.properties) - rank(b.properties));
  const results = features.slice(0, 5).map((f) => {
    const p = f.properties;
    const label = [p.name, p.city !== p.name ? p.city : "", p.state, p.country]
      .filter(Boolean)
      .join(", ");
    return {
      label,
      lng: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
    };
  });
  if (searchCache.size > 5000) searchCache.clear();
  searchCache.set(key, { at: Date.now(), results });
  return results;
}

// ---- Background worker: geocode locations saved without coordinates ----

let workerStarted = false;
let working = false;

async function processPending() {
  if (working) return;
  working = true;
  try {
    const pending = await prisma.location.findMany({
      where: { geocodeStatus: "pending" },
      take: 20,
      orderBy: { updatedAt: "asc" },
    });
    for (const loc of pending) {
      let point: { lat: number; lng: number } | null = null;
      try {
        point =
          (await geocodeAddress(addressString(loc))) ||
          // Fall back to a coarser query (city level) if the street fails
          (await geocodeAddress(
            addressString({ ...loc, address1: "", address2: "" }),
          ));
      } catch (e) {
        console.error("Geocode failed", loc.id, e);
      }
      await prisma.location.update({
        where: { id: loc.id },
        data: point
          ? { lat: point.lat, lng: point.lng, geocodeStatus: "ok" }
          : { geocodeStatus: "failed" },
      });
    }
  } finally {
    working = false;
  }
}

export function startGeocodeWorker() {
  if (workerStarted || process.env.DISABLE_GEOCODE_WORKER) return;
  workerStarted = true;
  setInterval(() => {
    processPending().catch((e) => console.error("Geocode worker", e));
  }, 5000).unref?.();
}

/** Kick the worker immediately (e.g. after a save). */
export function nudgeGeocoder() {
  startGeocodeWorker();
  processPending().catch((e) => console.error("Geocode worker", e));
}
