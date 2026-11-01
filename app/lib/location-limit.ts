export const FREE_LOCATION_LIMIT = 10;

export class LocationLimitError extends Error {
  constructor(limit = FREE_LOCATION_LIMIT) {
    super(
      `Your current allowance is ${limit} saved locations, including hidden and demo locations. Remove locations, reduce this import, or choose a larger plan before adding more. No locations from this operation were changed.`,
    );
    this.name = "LocationLimitError";
  }
}

type ImportKey = { id?: string; source: string; externalId: string | null };
/** Count new records once per import key and account for rows removed by sheet replacement. */
export function checkLocationCapacity(
  existing: ImportKey[],
  incoming: ImportKey[],
  replaceSource?: string,
  limit: number | null | Error = FREE_LOCATION_LIMIT,
) {
  if (replaceSource && incoming.some((row) => row.source !== replaceSource))
    throw new Error("Replacement source does not match imported locations.");
  const key = (row: ImportKey) => JSON.stringify([row.source, row.externalId]);
  const known = new Set(existing.filter((row) => row.externalId).map(key));
  const databaseIds = new Set(existing.map((row) => row.id).filter(Boolean));
  const kept = new Set<string>();
  let additions = 0;
  for (const row of incoming) {
    if (!row.externalId) {
      additions++;
      continue;
    }
    const id = key(row);
    kept.add(id);
    if (
      !known.has(id) &&
      !(row.source === "csv" && databaseIds.has(row.externalId))
    ) {
      additions++;
    }
    known.add(id);
  }
  const removed = replaceSource
    ? existing.filter(
        (row) =>
          row.source === replaceSource &&
          (!row.externalId || !kept.has(key(row))),
      ).length
    : 0;
  const finalCount = existing.length + additions - removed;
  // Preserve legacy accounts above the cap, allowing edits and deletions without new additions.
  if (additions > 0 && limit instanceof Error) throw limit;
  if (additions > 0 && typeof limit === "number" && finalCount > limit)
    throw new LocationLimitError(limit);
  return { additions, removed, finalCount };
}
