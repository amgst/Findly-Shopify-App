import prisma from "../db.server";

export const EVENT_TYPES = [
  "view",
  "search",
  "location_view",
  "directions",
  "link_click",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export async function recordEvent(
  publicId: string,
  type: string,
  data: { locationId?: string; query?: string },
) {
  if (!EVENT_TYPES.includes(type as EventType)) return;
  const locator = await prisma.locator.findUnique({
    where: { publicId },
    select: { id: true },
  });
  if (!locator) return;
  if (data.locationId) {
    const location = await prisma.location.findFirst({
      where: { id: data.locationId, locatorId: locator.id },
      select: { id: true },
    });
    if (!location) return;
  }
  await prisma.event.create({
    data: {
      locatorId: locator.id,
      type,
      locationId: data.locationId?.slice(0, 40) || null,
      query: data.query?.slice(0, 120) || null,
    },
  });
}

export async function getStats(locatorId: string, days = 30) {
  const since = new Date(Date.now() - days * 86400_000);
  const events = await prisma.event.findMany({
    where: { locatorId, createdAt: { gte: since } },
    select: { type: true, locationId: true, query: true, createdAt: true },
  });

  const totals: Record<EventType, number> = {
    view: 0, search: 0, location_view: 0, directions: 0, link_click: 0,
  };
  const byDay = new Map<string, number>();
  const searches = new Map<string, number>();
  const locCounts = new Map<string, { views: number; directions: number; clicks: number }>();

  for (let i = days - 1; i >= 0; i--) {
    byDay.set(new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10), 0);
  }

  for (const e of events) {
    totals[e.type as EventType] = (totals[e.type as EventType] ?? 0) + 1;
    if (e.type === "view") {
      const d = e.createdAt.toISOString().slice(0, 10);
      if (byDay.has(d)) byDay.set(d, (byDay.get(d) ?? 0) + 1);
    }
    if (e.type === "search" && e.query) {
      const q = e.query.toLowerCase().trim();
      searches.set(q, (searches.get(q) ?? 0) + 1);
    }
    if (e.locationId) {
      const c = locCounts.get(e.locationId) ?? { views: 0, directions: 0, clicks: 0 };
      if (e.type === "location_view") c.views++;
      if (e.type === "directions") c.directions++;
      if (e.type === "link_click") c.clicks++;
      locCounts.set(e.locationId, c);
    }
  }

  const locIds = [...locCounts.keys()];
  const names = new Map(
    (
      await prisma.location.findMany({
        where: { locatorId, id: { in: locIds } },
        select: { id: true, name: true },
      })
    ).map((l) => [l.id, l.name]),
  );

  return {
    days,
    totals,
    viewsByDay: [...byDay.entries()].map(([date, count]) => ({ date, count })),
    topSearches: [...searches.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count })),
    topLocations: [...locCounts.entries()]
      .map(([id, c]) => ({ id, name: names.get(id) ?? "(deleted)", ...c }))
      .sort((a, b) => b.views + b.directions - (a.views + a.directions))
      .slice(0, 10),
  };
}

export type Stats = Awaited<ReturnType<typeof getStats>>;
