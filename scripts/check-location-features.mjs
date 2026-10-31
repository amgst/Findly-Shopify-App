/* eslint-env node */
/* global globalThis */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
} from "react-router";
const originalFetch = globalThis.fetch;
const oldPrisma = globalThis.prismaGlobal;
const envNames = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_TOKEN_ENCRYPTION_KEY",
  "SHOPIFY_APP_URL",
  "SESSION_SECRET",
];
const env = Object.fromEntries(envNames.map((key) => [key, process.env[key]]));
Object.assign(process.env, {
  GOOGLE_CLIENT_ID: "test-client",
  GOOGLE_CLIENT_SECRET: "test-secret",
  GOOGLE_TOKEN_ENCRYPTION_KEY: "test-key-that-is-longer-than-32-characters",
  SHOPIFY_APP_URL: "https://app.test",
  SESSION_SECRET: "test-session-secret",
});
const writes = [];
const base = {
  id: "store-a",
  locatorId: "tenant-a",
  name: "Store A",
  address1: "1 Main St",
  address2: "",
  city: "New York",
  region: "NY",
  postalCode: "10001",
  country: "US",
  lat: 40,
  lng: -73,
  phone: "123",
  email: "",
  website: "",
  description: "",
  promo: "",
  imageUrl: "",
  hours: '{"mon":"09:00-18:00"}',
  links: "[]",
  products: "Shoes,Jackets",
  services: "Pickup",
  categories: "Retail",
  specialHours: '{"2026-12-25":"Closed"}',
  timezone: "America/New_York",
  pinIconUrl: "https://example.test/pin.png",
  pinColor: "#123456",
  featured: false,
  active: true,
  geocodeStatus: "manual",
  source: "manual",
  externalId: null,
};
globalThis.prismaGlobal = {
  location: {
    updateMany: async (args) => {
      assert.equal(args.where.locatorId, "tenant-a");
      writes.push(args);
      return { count: args.where.id.in.includes("store-a") ? 1 : 0 };
    },
    findFirst: async ({ where }) => {
      if (where.locator) {
        assert.equal(where.active, true);
        assert.deepEqual(where.lat, { not: null });
        return where.id === "store-a" && where.locator.publicId === "public-a"
          ? { ...base, locator: { settings: "{}" } }
          : null;
      }
      return { id: "store-a" };
    },
    findMany: async () => [],
  },
  locator: {
    findUnique: async () => ({ id: "tenant-a" }),
    update: async (args) => {
      writes.push(args);
      return args.data;
    },
  },
  event: {
    create: async (args) => {
      writes.push(args);
    },
    findMany: async () => [
      {
        type: "search",
        query: "Lahore",
        resultCount: 0,
        locationId: null,
        createdAt: new Date(),
      },
      {
        type: "search",
        query: "New York",
        resultCount: 2,
        locationId: null,
        createdAt: new Date(),
      },
    ],
  },
};
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "silent",
});
try {
  const features = await server.ssrLoadModule("/app/lib/location-features.ts");
  assert.deepEqual(
    features.parseSpecialHours(
      '{"2026-12-25":"Closed","2026-12-26":"10:00-14:00"}',
    ),
    { "2026-12-25": "Closed", "2026-12-26": "10:00-14:00" },
  );
  for (const value of [
    "null",
    "[]",
    '{"2026-02-30":"Closed"}',
    '{"2026-12-25":"25:00-26:00"}',
  ])
    assert.throws(() => features.parseSpecialHours(value));
  assert.equal(features.validTimezone("Asia/Karachi"), "Asia/Karachi");
  assert.throws(() => features.validTimezone("invalid/timezone"));
  assert.deepEqual(
    features.storeHoursToday(
      { thu: "09:00-18:00" },
      { "2026-12-25": "Closed" },
      "Asia/Karachi",
      new Date("2026-12-24T21:00:00Z"),
    ),
    { date: "2026-12-25", special: true, hours: "Closed" },
  );
  assert.equal(
    features.storeHoursToday(
      { thu: "09:00-18:00" },
      { "2026-12-25": "Closed" },
      "America/New_York",
      new Date("2026-12-24T21:00:00Z"),
    ).hours,
    "09:00-18:00",
  );
  const health = features.locationHealth([
    { ...base, lat: null, phone: "" },
    { ...base, id: "store-b" },
  ]);
  assert.ok(health[0].issues.includes("Missing map coordinates"));
  assert.ok(health[0].issues.includes("Missing contact details"));
  assert.ok(
    health.every((l) => l.issues.includes("Possible duplicate address")),
  );
  const locations = await server.ssrLoadModule("/app/lib/locations.server.ts");
  const form = new FormData();
  Object.entries({
    name: "Test",
    products: "Shoes;Jackets",
    services: "Pickup",
    specialHours: '{"2026-12-25":"Closed"}',
    timezone: "Asia/Karachi",
    pinColor: "#123456",
    pinIconUrl: "https://example.test/icon.png",
    lat: "31",
    lng: "74",
    active: "on",
  }).forEach(([key, value]) => form.set(key, value));
  const input = locations.locationFromForm(form);
  assert.equal(input.products, "Shoes,Jackets");
  assert.equal(input.timezone, "Asia/Karachi");
  assert.equal(input.pinColor, "#123456");
  const imported = locations.locationFromCsvRow(
    {
      name: "CSV",
      products: "Shoes",
      services: "Pickup",
      special_hours: '{"2026-12-25":"Closed"}',
      timezone: "Asia/Karachi",
      pin_color: "#123456",
    },
    "csv",
  );
  assert.equal(imported.specialHours, input.specialHours);
  assert.equal(imported.timezone, input.timezone);
  const bulk = new FormData();
  bulk.set("intent", "bulk_edit");
  bulk.append("ids", "store-a");
  bulk.append("ids", "foreign-store");
  bulk.set("field", "hours");
  bulk.set("value", "09:00-17:00");
  assert.match(
    (await locations.handleLocatorAction({ id: "tenant-a" }, bulk)).ok,
    /Updated 1/,
  );
  assert.equal(JSON.parse(writes.at(-1).data.hours).sun, "09:00-17:00");
  const count = writes.length;
  bulk.set("value", "25:00-26:00");
  assert.ok(
    (await locations.handleLocatorAction({ id: "tenant-a" }, bulk)).error,
  );
  assert.equal(writes.length, count);
  bulk.set("field", "locatorId");
  assert.ok(
    (await locations.handleLocatorAction({ id: "tenant-a" }, bulk)).error,
  );
  const publicStore = await locations.getPublicLocation("public-a", "store-a");
  assert.deepEqual(publicStore.location.products, ["Shoes", "Jackets"]);
  assert.equal(await locations.getPublicLocation("public-b", "store-a"), null);
  assert.equal(
    await locations.getPublicLocation("public-a", "hidden-store"),
    null,
  );
  assert.ok(!("googleRefreshToken" in publicStore));
  const page = await server.ssrLoadModule(
    "/app/routes/stores.$publicId.$locationId.tsx",
  );
  const routes = [
    {
      path: "/stores/:publicId/:locationId",
      loader: page.loader,
      Component: page.default,
    },
  ];
  const handler = createStaticHandler(routes);
  const pageContext = await handler.query(
    new Request("https://app.test/stores/public-a/store-a"),
  );
  assert.ok(!(pageContext instanceof Response));
  const pageHtml = renderToString(
    createElement(StaticRouterProvider, {
      router: createStaticRouter(handler.dataRoutes, pageContext),
      context: pageContext,
    }),
  );
  assert.match(pageHtml, /Opening hours/);
  assert.match(pageHtml, /Shoes, Jackets/);
  assert.match(pageHtml, /application\/ld\+json/);
  const ldJson = JSON.parse(
    pageHtml.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
    )[1],
  );
  assert.equal(ldJson.openingHoursSpecification[0].opens, "09:00");
  assert.equal(ldJson.specialOpeningHoursSpecification[0].opens, "00:00");
  const missing = await page
    .loader({
      request: new Request("https://app.test/stores/public-a/hidden-store"),
      params: { publicId: "public-a", locationId: "hidden-store" },
    })
    .catch((response) => response);
  assert.equal(missing.status, 404);
  const analytics = await server.ssrLoadModule("/app/lib/analytics.server.ts");
  await analytics.recordEvent("public-a", "search", {
    query: "Lahore",
    resultCount: 0,
  });
  assert.equal(writes.at(-1).data.resultCount, 0);
  await analytics.recordEvent("public-a", "search", {
    query: "Lahore",
    resultCount: -1,
  });
  assert.equal(writes.at(-1).data.resultCount, null);
  assert.deepEqual((await analytics.getStats("tenant-a")).unmetSearches, [
    { query: "lahore", count: 1 },
  ]);
  const google = await server.ssrLoadModule("/app/lib/google-sheets.server.ts");
  const encrypted = google.encryptGoogleToken("private-refresh-token");
  assert.ok(!encrypted.includes("private-refresh-token"));
  assert.equal(google.decryptGoogleToken(encrypted), "private-refresh-token");
  assert.throws(() =>
    google.decryptGoogleToken(
      encrypted.replace(/^./, encrypted[0] === "a" ? "b" : "a"),
    ),
  );
  const connection = new URL(google.googleConnectionUrl("tenant-a"));
  const ticket = connection.searchParams.get("ticket");
  assert.equal(google.verifyGoogleTicket(ticket), "tenant-a");
  assert.throws(() => google.verifyGoogleTicket(ticket + "tampered"));
  const start = await google.startGoogleConnection("tenant-a");
  const auth = new URL(start.headers.get("location"));
  assert.equal(auth.searchParams.get("access_type"), "offline");
  assert.equal(auth.searchParams.get("code_challenge_method"), "S256");
  assert.equal(
    (
      await google.finishGoogleConnection(
        new Request("https://app.test/google/callback?code=test&state=forged"),
      )
    ).status,
    400,
  );
  globalThis.fetch = async (url) => {
    assert.equal(String(url), "https://oauth2.googleapis.com/token");
    return Response.json({
      refresh_token: "new-private-token",
      scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    });
  };
  const callback = await google.finishGoogleConnection(
    new Request(
      `https://app.test/google/callback?code=test&state=${auth.searchParams.get("state")}`,
      { headers: { Cookie: start.headers.get("set-cookie").split(";")[0] } },
    ),
  );
  assert.equal(callback.status, 200);
  assert.equal(writes.at(-1).where.id, "tenant-a");
  assert.equal(
    google.decryptGoogleToken(writes.at(-1).data.googleRefreshToken),
    "new-private-token",
  );
  const requests = [];
  globalThis.fetch = async (url, options) => {
    const u = String(url);
    requests.push(u);
    if (u.endsWith("/token"))
      return Response.json({ access_token: "access-token" });
    assert.equal(options.headers.Authorization, "Bearer access-token");
    if (u.includes("?fields="))
      return Response.json({
        sheets: [
          { properties: { sheetId: 0, title: "First tab" } },
          { properties: { sheetId: 42, title: "Private tab" } },
        ],
      });
    return Response.json({
      values: [
        ["name", "phone"],
        ["Private Store", "+123"],
      ],
    });
  };
  const csv = await google.fetchPrivateSheetCsv(
    "https://docs.google.com/spreadsheets/d/abc/edit#gid=42",
    encrypted,
  );
  assert.ok(
    decodeURIComponent(requests.at(-1)).includes("'Private tab'!A1:AZ10002"),
  );
  assert.match(csv, /"\+123"/);
  // Run the actual widget in a minimal DOM to test filtering and holiday display without network or WebGL.
  const elements = new Map();
  const element = (selector) => {
    if (!elements.has(selector))
      elements.set(selector, {
        innerHTML: "",
        textContent: "",
        value: "",
        hidden: false,
        style: { setProperty() {} },
        parentElement: {},
        classList: { contains: () => false, add() {}, remove() {} },
        addEventListener() {},
        setAttribute() {},
        removeAttribute() {},
      });
    return elements.get(selector);
  };
  const window = {
    __FINDLY__: {
      id: "public-a",
      settings: {
        ...(await server.ssrLoadModule("/app/lib/settings.ts"))
          .DEFAULT_SETTINGS,
        useVisitorLocation: false,
      },
      apiBase: "https://app.test",
      preview: true,
      themes: [{ id: "streets", style: "test" }],
      locations: [publicStore.location],
    },
    addEventListener() {},
  };
  window.parent = window;
  const context = {
    window,
    document: {
      documentElement: element("html"),
      getElementById: element,
      querySelector: element,
      querySelectorAll: () => [],
    },
    navigator: {},
    Intl,
    Date,
    setTimeout,
    clearTimeout,
    console,
  };
  let widget = await readFile("public/widget/locator.js", "utf8");
  widget = widget.replace(
    "  // ------------------------------------------------------------ boot",
    "  window.testWidget = { filtered: filtered, state: state, hoursHtml: hoursHtml, localMatches: localMatches };\n  // ------------------------------------------------------------ boot",
  );
  vm.runInNewContext(widget, context);
  assert.equal(window.testWidget.filtered().length, 1);
  window.testWidget.state.product = "Unknown";
  assert.equal(window.testWidget.filtered().length, 0);
  window.testWidget.state.product = "Shoes";
  assert.equal(window.testWidget.filtered().length, 1);
  assert.equal(window.testWidget.localMatches("Pickup").length, 1);
  assert.match(window.testWidget.hoursHtml(publicStore.location), /2026-12-25/);
  let renderedMap;
  let imageFailure = false;
  class TestMap {
    constructor() {
      renderedMap = this;
      this.sources = {};
      this.layers = {};
      this.images = {};
      this.listeners = {};
    }
    on(event, layer, fn) {
      this.listeners[`${event}:${typeof layer === "string" ? layer : ""}`] =
        fn || layer;
    }
    addControl() {}
    jumpTo() {}
    addSource(id, source) {
      this.sources[id] = {
        ...source,
        setData(data) {
          this.data = data;
        },
      };
    }
    getSource(id) {
      return this.sources[id];
    }
    addLayer(layer) {
      this.layers[layer.id] = layer;
    }
    getStyle() {
      return { layers: [] };
    }
    hasImage(id) {
      return !!this.images[id];
    }
    addImage(id, image) {
      this.images[id] = image;
    }
    loadImage() {
      return imageFailure
        ? Promise.reject(new Error("Image blocked"))
        : Promise.resolve({ data: {} });
    }
  }
  const mapContext = {
    ...context,
    maplibregl: { Map: TestMap, NavigationControl: class {} },
  };
  mapContext.document = {
    ...context.document,
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage() {},
        getImageData: () => ({
          width: 36,
          height: 36,
          data: new Uint8ClampedArray(36 * 36 * 4),
        }),
      }),
    }),
  };
  vm.runInNewContext(widget, mapContext);
  renderedMap.listeners["style.load:"]();
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(renderedMap.sources.pp.data.features[0].properties.icon);
  assert.equal(
    renderedMap.sources.pp.data.features[0].properties.color,
    "#123456",
  );
  assert.equal(renderedMap.layers["pp-icons"].type, "symbol");
  imageFailure = true;
  vm.runInNewContext(widget, mapContext);
  renderedMap.listeners["style.load:"]();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    renderedMap.sources.pp.data.features[0].properties.icon,
    undefined,
    "broken icons retain the circle fallback",
  );
  console.log(
    "PASS: products/services, holidays and invalid dates, health/duplicates, scoped bulk edits, public-store isolation, unmet searches, encrypted tokens, OAuth state/PKCE, signed connection tickets, private sheet tab selection, and widget filters.",
  );
} finally {
  globalThis.fetch = originalFetch;
  if (oldPrisma === undefined) delete globalThis.prismaGlobal;
  else globalThis.prismaGlobal = oldPrisma;
  for (const key of envNames) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  await server.close();
}
