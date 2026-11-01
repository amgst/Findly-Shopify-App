/* eslint-env node */
/* global globalThis */
import assert from "node:assert/strict";
import { createServer } from "vite";
const previousPrisma = globalThis.prismaGlobal;
const previousVercel = process.env.VERCEL;
const billingEnvNames = ['SHOPIFY_PARTNER_ORG_ID','SHOPIFY_PARTNER_API_ACCESS_TOKEN','SHOPIFY_APP_GID'];
const billingEnv = Object.fromEntries(billingEnvNames.map((key) => [key, process.env[key]]));
let accessAccount = { id: 'web-account', shop: null, plan: 'free' };
process.env.VERCEL = "1";
let rows = [];
let serial = Promise.resolve();
let locked = false;
let nextId = 0;
const matches = (row, where) =>
  Object.entries(where).every(([key, value]) =>
    typeof value === "object" && value !== null
      ? value.in
        ? value.in.includes(row[key])
        : !value.notIn.includes(row[key])
      : row[key] === value,
  );
const location = {
  findMany: async ({ where }) => rows.filter((row) => matches(row, where)),
  findFirst: async ({ where }) =>
    rows.find((row) => matches(row, where)) || null,
  create: async ({ data }) => {
    assert.ok(locked);
    const row = { ...data, id: `created-${++nextId}` };
    rows.push(row);
    return row;
  },
  update: async ({ where, data }) => {
    const row = rows.find((r) => r.id === where.id);
    assert.ok(row);
    Object.assign(row, data);
    return row;
  },
  deleteMany: async ({ where }) => {
    const count = rows.filter((row) => matches(row, where)).length;
    rows = rows.filter((row) => !matches(row, where));
    return { count };
  },
  createMany: async ({ data, skipDuplicates }) => {
    assert.ok(locked);
    assert.equal(skipDuplicates, true);
    let count = 0;
    for (const row of data)
      if (
        !rows.some(
          (r) =>
            r.locatorId === row.locatorId &&
            r.source === row.source &&
            r.externalId === row.externalId,
        )
      ) {
        rows.push({ ...row, id: `created-${++nextId}` });
        count++;
      }
    return { count };
  },
};
const locator = {
  findUnique: async () => ({
    account: accessAccount,
  }),
  update: async ({ where }) => {
    assert.equal(where.id, "tenant-a");
    locked = true;
  },
};
globalThis.prismaGlobal = {
  location,
  locator,
  $transaction: async (callback, options) => {
    assert.equal(options.isolationLevel, "ReadCommitted");
    const previous = serial;
    let release;
    serial = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    const snapshot = structuredClone(rows);
    try {
      return await callback({ location, locator });
    } catch (error) {
      rows = snapshot;
      throw error;
    } finally {
      locked = false;
      release();
    }
  },
};
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "silent",
});
try {
  const { FREE_LOCATION_LIMIT, checkLocationCapacity, LocationLimitError } =
    await server.ssrLoadModule("/app/lib/location-limit.ts");
  const locations = await server.ssrLoadModule("/app/lib/locations.server.ts");
  assert.equal(FREE_LOCATION_LIMIT, 10);
  const make = (id, source = "csv") => ({
    ...locations.locationFromCsvRow(
      { id, name: `Store ${id}`, lat: "40", lng: "-73" },
      "csv",
    ),
    source,
  });
  const seed = (count, source = "csv") => {
    rows = Array.from({ length: count }, (_, i) => ({
      ...make(`external-${i}`, source),
      id: `existing-${i}`,
      locatorId: "tenant-a",
      active: false,
    }));
  };
  const action = (intent) => {
    const form = new FormData();
    form.set("intent", intent);
    return locations.handleLocatorAction({ id: "tenant-a" }, form);
  };
  seed(9);
  await locations.saveLocation("tenant-a", null, make("manual", "manual"));
  assert.equal(rows.length, 10);
  await assert.rejects(
    locations.saveLocation("tenant-a", null, make("blocked", "manual")),
    LocationLimitError,
  );
  assert.equal(rows.length, 10);
  await locations.saveLocation("tenant-a", "existing-0", {
    ...make("edited"),
    name: "Edited",
  });
  assert.equal(rows[0].name, "Edited");
  seed(9);
  const before = JSON.stringify(rows);
  await assert.rejects(
    locations.importLocations("tenant-a", [
      { ...make("external-0"), name: "Must not change" },
      make("new-a"),
      make("new-b"),
    ]),
    LocationLimitError,
  );
  assert.equal(
    JSON.stringify(rows),
    before,
    "oversized imports must not partially update existing rows",
  );
  seed(10);
  const updated = await locations.importLocations("tenant-a", [
    { ...make("external-0"), name: "Updated at cap" },
  ]);
  assert.equal(updated.updated, 1);
  assert.equal(rows.length, 10);
  await assert.rejects(
    locations.importLocations("tenant-a", [make("external-0", "sheet")]),
    LocationLimitError,
    "same external id in another source is a new location",
  );
  seed(10, "manual");
  rows.forEach((row) => {
    row.externalId = null;
  });
  const roundTrip = await locations.importLocations("tenant-a", [
    { ...make("existing-0"), name: "CSV round-trip edit" },
  ]);
  assert.equal(roundTrip.updated, 1);
  assert.equal(rows.length, 10);
  assert.equal(rows[0].source, "manual");
  assert.equal(rows[0].externalId, null);
  seed(9);
  const deduped = await locations.importLocations("tenant-a", [
    make("same-new"),
    make("same-new"),
  ]);
  assert.equal(deduped.created, 1);
  assert.equal(rows.length, 10);
  seed(10, "sheet");
  const replaced = await locations.importLocations(
    "tenant-a",
    Array.from({ length: 10 }, (_, i) => make(`replacement-${i}`, "sheet")),
    { replaceSource: "sheet" },
  );
  assert.equal(replaced.removed, 10);
  assert.equal(rows.length, 10);
  seed(10, "sheet");
  const sheetBefore = JSON.stringify(rows);
  await assert.rejects(
    locations.importLocations(
      "tenant-a",
      Array.from({ length: 11 }, (_, i) => make(`too-many-${i}`, "sheet")),
      { replaceSource: "sheet" },
    ),
    LocationLimitError,
  );
  assert.equal(JSON.stringify(rows), sheetBefore);
  seed(5);
  assert.match((await action("load_demo")).ok, /Added 5/);
  assert.equal(rows.length, 10);
  assert.match((await action("load_demo")).ok, /already loaded/);
  assert.equal(rows.length, 10);
  seed(6);
  assert.match((await action("load_demo")).error, /10 saved locations/);
  assert.equal(rows.length, 6);
  seed(12);
  await locations.importLocations("tenant-a", [
    { ...make("external-0"), name: "Legacy edit" },
  ]);
  assert.equal(rows.length, 12);
  await assert.rejects(
    locations.saveLocation("tenant-a", null, make("new")),
    LocationLimitError,
  );
  seed(9);
  const concurrent = await Promise.allSettled([
    locations.saveLocation("tenant-a", null, make("race-a")),
    locations.saveLocation("tenant-a", null, make("race-b")),
  ]);
  assert.equal(concurrent.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(rows.length, 10);
  seed(9);
  rows.push({ ...make("foreign"), id: "foreign", locatorId: "tenant-b" });
  await locations.saveLocation("tenant-a", null, make("tenant-a-new"));
  assert.equal(rows.filter((r) => r.locatorId === "tenant-a").length, 10);
  assert.equal(rows.filter((r) => r.locatorId === "tenant-b").length, 1);
  seed(9);
  const graphql = async () =>
    Response.json({
      data: {
        locations: {
          nodes: [0, 1].map((id) => ({
            id: `gid://shopify/Location/${id}`,
            name: "Shopify store",
            isActive: true,
            address: { latitude: 40, longitude: -73 },
          })),
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    });
  await assert.rejects(
    locations.syncShopifyLocations(graphql, "tenant-a"),
    LocationLimitError,
  );
  assert.equal(rows.length, 9);
  assert.throws(
    () => checkLocationCapacity([], [make("a")], "sheet"),
    /source/,
  );
  Object.assign(process.env, { SHOPIFY_PARTNER_ORG_ID: '1', SHOPIFY_PARTNER_API_ACCESS_TOKEN: 'test-only', SHOPIFY_APP_GID: 'gid://shopify/App/1' });
  accessAccount = { id: 'shop-account', shop: 'test.myshopify.com', plan: 'starter', planVerifiedAt: new Date(), planHasSubscription: true };
  seed(49); await locations.saveLocation('tenant-a', null, make('starter-new')); assert.equal(rows.length, 50);
  await assert.rejects(locations.saveLocation('tenant-a', null, make('starter-blocked')), LocationLimitError);
  accessAccount = { ...accessAccount, plan: 'pro', planVerifiedAt: new Date() };
  seed(200); await locations.saveLocation('tenant-a', null, make('unlimited-new')); assert.equal(rows.length, 201);
  const proDemo = await action('load_demo'); assert.match(proDemo.ok, /Added 5/); assert.equal(rows.length, 206);
  await locations.importLocations('tenant-a', [make('pro-import')]); assert.equal(rows.length, 207);
  await locations.syncShopifyLocations(graphql, 'tenant-a'); assert.equal(rows.length, 209);
  console.log(
    "PASS: 10-location cap, hidden/demo counts, manual additions and edits, atomic CSV imports, source-aware deduplication, net sheet replacements, Shopify sync, tenant isolation, legacy records, and concurrent requests through serialized transactions.",
  );
} finally {
  if (previousPrisma === undefined) delete globalThis.prismaGlobal;
  else globalThis.prismaGlobal = previousPrisma;
  if (previousVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = previousVercel;
  for (const key of billingEnvNames) { if (billingEnv[key] === undefined) delete process.env[key]; else process.env[key] = billingEnv[key]; }
  await server.close();
}
