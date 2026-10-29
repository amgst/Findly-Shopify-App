// In-process background jobs. Fine for a single server; move to a real queue/cron when scaling out.
import prisma from "../db.server";
import { IS_SERVERLESS, startGeocodeWorker } from "./geocode.server";
import { syncSheet } from "./locations.server";

const SHEET_SYNC_EVERY_MS = 60 * 60 * 1000;
let started = false;

export async function syncDueSheets() {
  const due = await prisma.locator.findMany({
    where: {
      sheetUrl: { not: null },
      OR: [
        { sheetSyncedAt: null },
        { sheetSyncedAt: { lt: new Date(Date.now() - SHEET_SYNC_EVERY_MS) } },
      ],
    },
    select: { id: true, sheetUrl: true },
    take: 50,
  });
  for (const l of due) {
    try {
      const r = await syncSheet(l);
      if ("error" in r) console.warn(`Sheet sync failed for ${l.id}: ${r.error}`);
    } catch (e) {
      console.error(`Sheet sync crashed for ${l.id}`, e);
    }
  }
}

export function startBackgroundJobs() {
  if (started || process.env.DISABLE_BACKGROUND_JOBS || IS_SERVERLESS) return;
  started = true;
  startGeocodeWorker();
  setInterval(() => {
    syncDueSheets().catch((e) => console.error("Sheet sync job", e));
  }, 5 * 60 * 1000).unref?.();
}
