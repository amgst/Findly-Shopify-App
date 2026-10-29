// Loader data shared by the Shopify admin (/app/*) and web dashboard (/dashboard/*).
import type { Locator } from "@prisma/client";
import prisma from "../db.server";
import { getStats } from "./analytics.server";
import { listLocations } from "./locations.server";
import { parseSettings } from "./settings";

export async function overviewData(locator: Locator) {
  const [total, live, failed, views30d] = await Promise.all([
    prisma.location.count({ where: { locatorId: locator.id } }),
    prisma.location.count({ where: { locatorId: locator.id, active: true, lat: { not: null } } }),
    prisma.location.count({ where: { locatorId: locator.id, geocodeStatus: "failed" } }),
    prisma.event.count({
      where: {
        locatorId: locator.id,
        type: "view",
        createdAt: { gte: new Date(Date.now() - 30 * 86400_000) },
      },
    }),
  ]);
  return { publicId: locator.publicId, counts: { total, live, failed }, views30d };
}

export async function locationsData(locator: Locator) {
  return {
    locations: await listLocations(locator.id),
    sheetUrl: locator.sheetUrl,
    sheetSyncedAt: locator.sheetSyncedAt,
  };
}

export function designData(locator: Locator) {
  return { publicId: locator.publicId, settings: parseSettings(locator.settings) };
}

export async function analyticsData(locator: Locator) {
  return { stats: await getStats(locator.id, 30) };
}
