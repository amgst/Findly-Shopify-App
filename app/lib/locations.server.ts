import prisma from "../db.server";
import type { Location, Locator } from "@prisma/client";
import { parseCsvObjects, toCsv } from "./csv";
import { nudgeGeocoder } from "./geocode.server";
import { DAYS, parseSettings, settingsFromForm } from "./settings";

export type LocationInput = Omit<
  Location,
  "id" | "locatorId" | "createdAt" | "updatedAt" | "locator"
>;

// ---------------------------------------------------------------- helpers

function s(form: FormData, k: string, max = 500) {
  return String(form.get(k) ?? "").trim().slice(0, max);
}

function safeUrl(v: string) {
  if (!v) return "";
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : "";
  } catch {
    return "";
  }
}

function coord(v: string, min: number, max: number) {
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function normCategories(v: string) {
  return v
    .split(/[,;|]/)
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 20)
    .join(",");
}

/** Build a Location record from the admin edit form. */
export function locationFromForm(form: FormData): LocationInput {
  const lat = coord(s(form, "lat"), -90, 90);
  const lng = coord(s(form, "lng"), -180, 180);
  const hours: Record<string, string> = {};
  for (const d of DAYS) {
    const v = s(form, `hours_${d}`, 60);
    if (v) hours[d] = v;
  }
  const links: { label: string; url: string }[] = [];
  for (let i = 0; i < 4; i++) {
    const label = s(form, `link_label_${i}`, 60);
    const url = safeUrl(s(form, `link_url_${i}`, 500));
    if (label && url) links.push({ label, url });
  }
  const hasCoords = lat !== null && lng !== null;
  return {
    name: s(form, "name", 120) || "Untitled location",
    address1: s(form, "address1"),
    address2: s(form, "address2"),
    city: s(form, "city", 120),
    region: s(form, "region", 120),
    postalCode: s(form, "postalCode", 30),
    country: s(form, "country", 80),
    lat: hasCoords ? lat : null,
    lng: hasCoords ? lng : null,
    geocodeStatus: hasCoords ? "manual" : "pending",
    phone: s(form, "phone", 60),
    email: s(form, "email", 120),
    website: safeUrl(s(form, "website")),
    description: s(form, "description", 2000),
    promo: s(form, "promo", 300),
    imageUrl: safeUrl(s(form, "imageUrl")),
    categories: normCategories(s(form, "categories")),
    hours: JSON.stringify(hours),
    links: JSON.stringify(links),
    featured: form.get("featured") === "on",
    active: form.get("active") === "on",
    source: "manual",
    externalId: null,
  };
}

/** Accepts common header spellings from spreadsheets and other locators. */
function pick(row: Record<string, string>, ...keys: string[]) {
  for (const k of keys) if (row[k]) return row[k];
  return "";
}

export function locationFromCsvRow(
  row: Record<string, string>,
  source: "csv" | "sheet",
): LocationInput | null {
  const name = pick(row, "name", "store_name", "location_name", "title");
  if (!name) return null;
  const lat = coord(pick(row, "lat", "latitude"), -90, 90);
  const lng = coord(pick(row, "lng", "lon", "long", "longitude"), -180, 180);
  const hours: Record<string, string> = {};
  const dayNames: Record<string, string> = {
    mon: "monday", tue: "tuesday", wed: "wednesday", thu: "thursday",
    fri: "friday", sat: "saturday", sun: "sunday",
  };
  for (const d of DAYS) {
    const v = pick(row, `hours_${d}`, d, dayNames[d]);
    if (v) hours[d] = v.slice(0, 60);
  }
  const links: { label: string; url: string }[] = [];
  for (let i = 1; i <= 4; i++) {
    const label = pick(row, `link_${i}_label`, `link${i}_label`);
    const url = safeUrl(pick(row, `link_${i}_url`, `link${i}_url`));
    if (label && url) links.push({ label, url });
  }
  const hasCoords = lat !== null && lng !== null;
  const activeRaw = pick(row, "active", "enabled").toLowerCase();
  return {
    name: name.slice(0, 120),
    address1: pick(row, "address", "address1", "address_1", "street"),
    address2: pick(row, "address2", "address_2"),
    city: pick(row, "city", "town"),
    region: pick(row, "state", "region", "province", "county"),
    postalCode: pick(row, "postal_code", "postcode", "zip", "zip_code"),
    country: pick(row, "country", "country_code"),
    lat: hasCoords ? lat : null,
    lng: hasCoords ? lng : null,
    geocodeStatus: hasCoords ? "manual" : "pending",
    phone: pick(row, "phone", "telephone", "phone_number"),
    email: pick(row, "email"),
    website: safeUrl(pick(row, "website", "url", "web")),
    description: pick(row, "description", "notes").slice(0, 2000),
    promo: pick(row, "promo", "promotion").slice(0, 300),
    imageUrl: safeUrl(pick(row, "image", "image_url", "photo")),
    categories: normCategories(pick(row, "categories", "category", "tags")),
    hours: JSON.stringify(hours),
    links: JSON.stringify(links),
    featured: ["yes", "true", "1"].includes(pick(row, "featured").toLowerCase()),
    active: !["no", "false", "0"].includes(activeRaw),
    source,
    externalId: pick(row, "id", "external_id", "store_id") || null,
  };
}

// ---------------------------------------------------------------- queries

export function listLocations(locatorId: string) {
  return prisma.location.findMany({
    where: { locatorId },
    orderBy: [{ featured: "desc" }, { name: "asc" }],
  });
}

export async function getLocation(locatorId: string, id: string) {
  return prisma.location.findFirst({ where: { id, locatorId } });
}

export async function saveLocation(
  locatorId: string,
  id: string | null,
  data: LocationInput,
) {
  let saved;
  if (id) {
    const existing = await getLocation(locatorId, id);
    if (!existing) throw new Response("Not found", { status: 404 });
    // Keep the import source/external id so re-syncs still match this row.
    saved = await prisma.location.update({
      where: { id },
      data: { ...data, source: existing.source, externalId: existing.externalId },
    });
  } else {
    saved = await prisma.location.create({ data: { ...data, locatorId } });
  }
  if (saved.geocodeStatus === "pending") nudgeGeocoder();
  return saved;
}

export async function deleteLocations(locatorId: string, ids: string[]) {
  await prisma.location.deleteMany({ where: { locatorId, id: { in: ids } } });
}

/**
 * Import rows. Rows with an external id are upserted (so re-importing the
 * same file updates instead of duplicating). With `replace`, rows from the
 * same source that are no longer present are deleted (used for sheet sync).
 */
export async function importLocations(
  locatorId: string,
  rows: LocationInput[],
  opts: { replaceSource?: string } = {},
) {
  let created = 0;
  let updated = 0;
  const keepIds: string[] = [];
  for (const row of rows) {
    if (row.externalId) {
      const existing = await prisma.location.findFirst({
        where: { locatorId, source: row.source, externalId: row.externalId },
      });
      if (existing) {
        const unchangedAddress =
          existing.address1 === row.address1 &&
          existing.city === row.city &&
          existing.postalCode === row.postalCode &&
          existing.country === row.country;
        // Don't re-geocode if the address didn't change.
        const geo =
          row.lat === null && unchangedAddress && existing.lat !== null
            ? { lat: existing.lat, lng: existing.lng, geocodeStatus: existing.geocodeStatus }
            : {};
        await prisma.location.update({
          where: { id: existing.id },
          data: { ...row, ...geo },
        });
        keepIds.push(existing.id);
        updated++;
        continue;
      }
    }
    const c = await prisma.location.create({ data: { ...row, locatorId } });
    keepIds.push(c.id);
    created++;
  }
  let removed = 0;
  if (opts.replaceSource) {
    const r = await prisma.location.deleteMany({
      where: { locatorId, source: opts.replaceSource, id: { notIn: keepIds } },
    });
    removed = r.count;
  }
  nudgeGeocoder();
  return { created, updated, removed };
}

export async function importCsvText(locatorId: string, text: string) {
  const rows = parseCsvObjects(text)
    .map((r) => locationFromCsvRow(r, "csv"))
    .filter((r): r is LocationInput => r !== null);
  if (!rows.length) {
    return { error: "No rows found. The CSV needs a header row with at least a 'name' column." };
  }
  if (rows.length > 10000) return { error: "Imports are limited to 10,000 rows." };
  return importLocations(locatorId, rows);
}

/** Turn a normal Google Sheets link into its CSV export URL. */
export function normalizeSheetUrl(url: string) {
  const m = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (m && !/output=csv|format=csv/.test(url)) {
    const gid = url.match(/[#&?]gid=(\d+)/)?.[1];
    return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gid ? `&gid=${gid}` : ""}`;
  }
  return url;
}

export async function syncSheet(locator: Pick<Locator, "id" | "sheetUrl">) {
  if (!locator.sheetUrl) return { error: "No sheet URL saved." };
  const res = await fetch(normalizeSheetUrl(locator.sheetUrl), { redirect: "follow" });
  if (!res.ok) {
    return {
      error: `Couldn't read the sheet (HTTP ${res.status}). Make sure it's shared as "Anyone with the link can view".`,
    };
  }
  const text = await res.text();
  if (/^\s*<!doctype html|<html/i.test(text)) {
    return { error: "That link returned a web page, not CSV. Share the sheet publicly or use File → Share → Publish to web → CSV." };
  }
  const rows = parseCsvObjects(text)
    .map((r, i) => {
      const l = locationFromCsvRow(r, "sheet");
      // Sheets without an id column: use row number so updates stay stable.
      if (l && !l.externalId) l.externalId = `row-${i + 2}`;
      return l;
    })
    .filter((r): r is LocationInput => r !== null);
  const result = await importLocations(locator.id, rows, { replaceSource: "sheet" });
  await prisma.locator.update({
    where: { id: locator.id },
    data: { sheetSyncedAt: new Date() },
  });
  return result;
}

export async function exportCsv(locatorId: string) {
  const locs = await listLocations(locatorId);
  const header = [
    "id", "name", "address", "address2", "city", "state", "postal_code", "country",
    "lat", "lng", "phone", "email", "website", "categories", "description", "promo",
    "image_url", "featured", "active",
    ...DAYS.map((d) => `hours_${d}`),
    "link_1_label", "link_1_url", "link_2_label", "link_2_url",
  ];
  const rows = locs.map((l) => {
    const h = JSON.parse(l.hours || "{}");
    const links = JSON.parse(l.links || "[]");
    return [
      l.externalId || l.id, l.name, l.address1, l.address2, l.city, l.region,
      l.postalCode, l.country, l.lat, l.lng, l.phone, l.email, l.website,
      l.categories, l.description, l.promo, l.imageUrl,
      l.featured ? "yes" : "no", l.active ? "yes" : "no",
      ...DAYS.map((d) => h[d] || ""),
      links[0]?.label, links[0]?.url, links[1]?.label, links[1]?.url,
    ];
  });
  return toCsv([header, ...rows]);
}

// ---------------------------------------------------------------- Shopify

type AdminGraphql = (
  query: string,
  opts?: { variables?: Record<string, unknown> },
) => Promise<Response>;

const LOCATIONS_QUERY = `#graphql
  query FindlyLocations($cursor: String) {
    locations(first: 100, after: $cursor, includeInactive: false) {
      nodes {
        id
        name
        isActive
        address {
          address1
          address2
          city
          province
          zip
          country
          phone
          latitude
          longitude
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }`;

/** Pull the shop's Shopify Locations into the locator (upsert by GID). */
export async function syncShopifyLocations(graphql: AdminGraphql, locatorId: string) {
  const rows: LocationInput[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 20; page++) {
    const res = await graphql(LOCATIONS_QUERY, { variables: { cursor } });
    const json = (await res.json()) as {
      data?: {
        locations: {
          nodes: {
            id: string;
            name: string;
            isActive: boolean;
            address: Record<string, string | number | null>;
          }[];
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
        };
      };
      errors?: unknown;
    };
    if (!json.data) throw new Error(`Shopify API error: ${JSON.stringify(json.errors)}`);
    for (const n of json.data.locations.nodes) {
      const a = n.address;
      const lat = typeof a.latitude === "number" ? a.latitude : null;
      const lng = typeof a.longitude === "number" ? a.longitude : null;
      rows.push({
        name: n.name,
        address1: String(a.address1 ?? ""),
        address2: String(a.address2 ?? ""),
        city: String(a.city ?? ""),
        region: String(a.province ?? ""),
        postalCode: String(a.zip ?? ""),
        country: String(a.country ?? ""),
        lat,
        lng,
        geocodeStatus: lat !== null && lng !== null ? "ok" : "pending",
        phone: String(a.phone ?? ""),
        email: "",
        website: "",
        description: "",
        promo: "",
        imageUrl: "",
        categories: "",
        hours: "{}",
        links: "[]",
        featured: false,
        active: n.isActive,
        source: "shopify",
        externalId: n.id,
      });
    }
    if (!json.data.locations.pageInfo.hasNextPage) break;
    cursor = json.data.locations.pageInfo.endCursor;
  }
  return importShopifyRows(locatorId, rows);
}

/** Shopify rows: keep merchant-entered extras (hours, photos, links) on update. */
async function importShopifyRows(locatorId: string, rows: LocationInput[]) {
  let created = 0;
  let updated = 0;
  for (const row of rows) {
    const existing = await prisma.location.findFirst({
      where: { locatorId, source: "shopify", externalId: row.externalId },
    });
    if (existing) {
      await prisma.location.update({
        where: { id: existing.id },
        data: {
          name: row.name,
          address1: row.address1,
          address2: row.address2,
          city: row.city,
          region: row.region,
          postalCode: row.postalCode,
          country: row.country,
          phone: row.phone || existing.phone,
          ...(row.lat !== null
            ? { lat: row.lat, lng: row.lng, geocodeStatus: "ok" }
            : existing.address1 !== row.address1 || existing.city !== row.city
              ? { lat: null, lng: null, geocodeStatus: "pending" }
              : {}),
        },
      });
      updated++;
    } else {
      await prisma.location.create({ data: { ...row, locatorId } });
      created++;
    }
  }
  nudgeGeocoder();
  return { created, updated, removed: 0 };
}

// ---------------------------------------------------------------- shared admin actions

/**
 * One action handler used by both the Shopify admin and the web dashboard.
 * `shopifyGraphql` is only provided inside the Shopify admin.
 */
export async function handleLocatorAction(
  locator: Locator,
  form: FormData,
  shopifyGraphql?: AdminGraphql,
): Promise<{ ok?: string; error?: string }> {
  const intent = String(form.get("intent") || "");
  try {
    switch (intent) {
      case "save_location": {
        const id = String(form.get("id") || "") || null;
        await saveLocation(locator.id, id, locationFromForm(form));
        return { ok: id ? "Location updated" : "Location added" };
      }
      case "delete_locations": {
        const ids = form.getAll("ids").map(String).filter(Boolean);
        await deleteLocations(locator.id, ids);
        return { ok: `Deleted ${ids.length} location${ids.length === 1 ? "" : "s"}` };
      }
      case "toggle_active": {
        const id = String(form.get("id"));
        const loc = await getLocation(locator.id, id);
        if (loc) {
          await prisma.location.update({ where: { id }, data: { active: !loc.active } });
        }
        return { ok: "Saved" };
      }
      case "import_csv": {
        const file = form.get("file");
        const text =
          file && typeof file === "object" && "text" in file
            ? await (file as File).text()
            : String(form.get("csv") || "");
        const r = await importCsvText(locator.id, text);
        if ("error" in r) return { error: r.error };
        return { ok: `Imported: ${r.created} added, ${r.updated} updated` };
      }
      case "save_sheet": {
        const url = String(form.get("sheetUrl") || "").trim();
        await prisma.locator.update({
          where: { id: locator.id },
          data: { sheetUrl: url ? safeUrl(url) : null },
        });
        if (!url) return { ok: "Sheet disconnected" };
        const r = await syncSheet({ id: locator.id, sheetUrl: safeUrl(url) });
        if ("error" in r) return { error: r.error };
        return { ok: `Sheet synced: ${r.created} added, ${r.updated} updated, ${r.removed} removed` };
      }
      case "sync_sheet": {
        const r = await syncSheet(locator);
        if ("error" in r) return { error: r.error };
        return { ok: `Sheet synced: ${r.created} added, ${r.updated} updated, ${r.removed} removed` };
      }
      case "sync_shopify": {
        if (!shopifyGraphql) return { error: "Shopify sync is only available inside Shopify." };
        const r = await syncShopifyLocations(shopifyGraphql, locator.id);
        return { ok: `Shopify locations synced: ${r.created} added, ${r.updated} updated` };
      }
      case "retry_geocode": {
        await prisma.location.updateMany({
          where: { locatorId: locator.id, geocodeStatus: "failed" },
          data: { geocodeStatus: "pending" },
        });
        nudgeGeocoder();
        return { ok: "Retrying address lookup" };
      }
      case "save_settings": {
        const settings = settingsFromForm(form);
        await prisma.locator.update({
          where: { id: locator.id },
          data: { settings: JSON.stringify(settings) },
        });
        return { ok: "Design saved" };
      }
      default:
        return { error: `Unknown action "${intent}"` };
    }
  } catch (e) {
    if (e instanceof Response) throw e;
    console.error(e);
    return { error: e instanceof Error ? e.message : "Something went wrong" };
  }
}

// ---------------------------------------------------------------- public payload

export async function getPublicLocator(publicId: string) {
  const locator = await prisma.locator.findUnique({ where: { publicId } });
  if (!locator) return null;
  const locations = await prisma.location.findMany({
    where: { locatorId: locator.id, active: true, lat: { not: null }, lng: { not: null } },
    orderBy: [{ featured: "desc" }, { name: "asc" }],
  });
  return {
    id: locator.publicId,
    settings: parseSettings(locator.settings),
    locations: locations.map((l) => ({
      id: l.id,
      name: l.name,
      address1: l.address1,
      address2: l.address2,
      city: l.city,
      region: l.region,
      postalCode: l.postalCode,
      country: l.country,
      lat: l.lat,
      lng: l.lng,
      phone: l.phone,
      email: l.email,
      website: l.website,
      description: l.description,
      promo: l.promo,
      imageUrl: l.imageUrl,
      categories: l.categories ? l.categories.split(",") : [],
      hours: JSON.parse(l.hours || "{}"),
      links: JSON.parse(l.links || "[]"),
      featured: l.featured,
    })),
  };
}

export type PublicLocator = NonNullable<Awaited<ReturnType<typeof getPublicLocator>>>;
