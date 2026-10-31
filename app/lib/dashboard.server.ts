// Loader data shared by the Shopify admin (/app/*) and web dashboard (/dashboard/*).
import type { Locator } from "@prisma/client";
import prisma from "../db.server";
import { getStats } from "./analytics.server";
import { IS_SERVERLESS, processPending } from "./geocode.server";
import { listLocations } from "./locations.server";
import { googleReady } from "./google-sheets.server";
import { DEFAULT_SETTINGS, parseSettings } from "./settings";

export async function overviewData(locator: Locator) {
  const [total, live, failed, views30d] = await Promise.all([
    prisma.location.count({ where: { locatorId: locator.id } }),
    prisma.location.count({
      where: { locatorId: locator.id, active: true, lat: { not: null } },
    }),
    prisma.location.count({
      where: { locatorId: locator.id, geocodeStatus: "failed" },
    }),
    prisma.event.count({
      where: {
        locatorId: locator.id,
        type: "view",
        createdAt: { gte: new Date(Date.now() - 30 * 86400_000) },
      },
    }),
  ]);
  // Preview views aren't recorded, so any "view" event means a real visitor saw the live locator.
  const everViewed =
    views30d > 0 ||
    !!(await prisma.event.findFirst({
      where: { locatorId: locator.id, type: "view" },
      select: { id: true },
    }));
  const customized =
    JSON.stringify(parseSettings(locator.settings)) !==
    JSON.stringify(parseSettings(JSON.stringify(DEFAULT_SETTINGS)));
  return {
    publicId: locator.publicId,
    counts: { total, live, failed },
    views30d,
    everViewed,
    customized,
  };
}

export async function locationsData(locator: Locator) {
  // Serverless: the Locations page refreshes every few seconds while addresses are
  // pending, so each refresh looks up a few more (Nominatim allows ~1 per second).
  if (IS_SERVERLESS) await processPending(3, locator.id);
  return {
    publicId: locator.publicId,
    googleReady: googleReady(),
    googleConnected: Boolean(locator.googleRefreshToken),
    locations: await listLocations(locator.id),
    sheetUrl: locator.sheetUrl,
    sheetSyncedAt: locator.sheetSyncedAt,
  };
}

export function designData(locator: Locator) {
  return {
    publicId: locator.publicId,
    settings: parseSettings(locator.settings),
  };
}

export async function analyticsData(locator: Locator) {
  return { stats: await getStats(locator.id, 30) };
}
