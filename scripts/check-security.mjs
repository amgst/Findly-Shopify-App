/* eslint-env node */
/* global globalThis */
// Run with: node scripts/check-security.mjs (no database or outbound requests).
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const originalFetch = globalThis.fetch;
const calls = [];
let eventWrites = 0;
const prisma = {
  locator: { findUnique: async () => ({ id: 'tenant-a' }), update: async () => { throw new Error('Unexpected write'); } },
  location: {
    findFirst: async ({ where }) => { assert.equal(where.locatorId, 'tenant-a'); return where.id === 'own-location' ? { id: where.id } : null; },
    findMany: async ({ where }) => { assert.equal(where.locatorId, 'tenant-a'); return []; },
    create: async () => { throw new Error('Unexpected write'); },
    deleteMany: async () => { throw new Error('Unexpected deletion'); },
  },
  event: {
    create: async () => { eventWrites++; },
    findMany: async () => [{ type: 'location_view', locationId: 'foreign-location', query: null, createdAt: new Date() }],
  },
};
globalThis.prismaGlobal = prisma;
const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
try {
  const sheets = await server.ssrLoadModule('/app/lib/sheet-fetch.server.ts');
  assert.equal(sheets.normalizeSheetUrl('https://docs.google.com/spreadsheets/d/abc/edit#gid=42'), 'https://docs.google.com/spreadsheets/d/abc/export?format=csv&gid=42');
  assert.equal(new URL(sheets.normalizeSheetUrl('https://docs.google.com/spreadsheets/d/abc/edit?resourcekey=key')).searchParams.get('resourcekey'), 'key');
  assert.equal(new URL(sheets.normalizeSheetUrl('https://docs.google.com/spreadsheets/d/e/published/pub?gid=42')).searchParams.get('output'), 'csv');
  for (const url of ['http://127.0.0.1', 'https://169.254.169.254/latest/meta-data/', 'https://evil.test/docs.google.com/spreadsheets/d/abc', 'https://docs.google.com.evil.test/spreadsheets/d/abc', 'https://user@docs.google.com/spreadsheets/d/abc', 'https://docs.google.com:444/spreadsheets/d/abc']) {
    assert.throws(() => sheets.normalizeSheetUrl(url));
  }
  const sheetUrl = 'https://docs.google.com/spreadsheets/d/abc/edit';
  globalThis.fetch = async (url, options) => { calls.push(String(url)); assert.equal(options.redirect, 'manual'); assert.ok(options.signal); return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/admin' } }); };
  await assert.rejects(sheets.fetchSheetCsv(sheetUrl), /unsupported host/);
  assert.equal(calls.length, 1, 'redirect must be rejected before a second request');
  globalThis.fetch = async () => new Response('name\nExample', { headers: { 'content-length': String(6 * 1024 * 1024) } });
  await assert.rejects(sheets.fetchSheetCsv(sheetUrl), /5 MB/);
  globalThis.fetch = async () => new Response(new Uint8Array(5 * 1024 * 1024 + 1));
  await assert.rejects(sheets.fetchSheetCsv(sheetUrl), /5 MB/);
  globalThis.fetch = async () => new Response(null, { status: 302, headers: { location: sheetUrl } });
  await assert.rejects(sheets.fetchSheetCsv(sheetUrl), /too many redirects/);
  globalThis.fetch = async () => new Response('name,lat,lng\nStore,40,-73');
  assert.match(await sheets.fetchSheetCsv(sheetUrl), /Store/);
  const analytics = await server.ssrLoadModule('/app/lib/analytics.server.ts');
  await analytics.recordEvent('public-id', 'location_view', { locationId: 'foreign-location' });
  assert.equal(eventWrites, 0);
  await analytics.recordEvent('public-id', 'location_view', { locationId: 'own-location' });
  assert.equal(eventWrites, 1);
  const stats = await analytics.getStats('tenant-a');
  assert.equal(stats.topLocations[0].name, '(deleted)');
  const settings = await server.ssrLoadModule('/app/lib/settings.ts');
  const csv = await server.ssrLoadModule('/app/lib/csv.ts');
  assert.equal(csv.toCsv([['=1+1', '+123', '@SUM(A1)', '-cmd', -73, 'Normal text']]), "'=1+1,'+123,'@SUM(A1),'-cmd,-73,Normal text");
  assert.deepEqual(settings.parseSettings('null'), settings.DEFAULT_SETTINGS);
  assert.deepEqual(settings.parseSettings('[]'), settings.DEFAULT_SETTINGS);
  const widget = await server.ssrLoadModule('/app/lib/widget-html.server.ts');
  const html = widget.renderLocatorHtml({ id: 'public-id', settings: settings.DEFAULT_SETTINGS, locations: [] }, { origin: 'https://example.test/"><script>alert(1)</script>' });
  assert.ok(!html.includes('src="https://example.test/"><script>'));
  const previousAppUrl = process.env.SHOPIFY_APP_URL;
  delete process.env.SHOPIFY_APP_URL;
  try {
    assert.equal(widget.appOrigin(new Request('https://real.test/locator', { headers: { 'x-forwarded-host': 'evil.test', 'x-forwarded-proto': 'javascript' } })), 'https://real.test');
  } finally { if (previousAppUrl !== undefined) process.env.SHOPIFY_APP_URL = previousAppUrl; }
  const locations = await server.ssrLoadModule('/app/lib/locations.server.ts');
  globalThis.fetch = async () => new Response(null, { status: 401 });
  const deniedForm = new FormData(); deniedForm.set('intent', 'save_sheet'); deniedForm.set('sheetUrl', sheetUrl);
  assert.match((await locations.handleLocatorAction({ id: 'tenant-a' }, deniedForm)).error, /Google denied access/, 'failed connection must return access instructions before any database write');
  globalThis.fetch = async () => new Response(null, { status: 302, headers: { location: 'https://accounts.google.com/signin' } });
  await assert.rejects(sheets.fetchSheetCsv(sheetUrl), /Google requires sign-in/);
  globalThis.fetch = async () => new Response('unexpected-header\nnot-a-location');
  assert.ok((await locations.syncSheet({ id: 'tenant-a', sheetUrl })).error, 'invalid sheet must not delete existing data');
  assert.ok((await locations.importCsvText('tenant-a', 'x'.repeat(5 * 1024 * 1024 + 1))).error);
  const form = new FormData(); form.set('intent', 'save_sheet'); form.set('sheetUrl', 'http://127.0.0.1/private');
  assert.ok((await locations.handleLocatorAction({ id: 'tenant-a' }, form)).error);
  const previousEnv = { nodeEnv: process.env.NODE_ENV, session: process.env.SESSION_SECRET, shopify: process.env.SHOPIFY_API_SECRET };
  process.env.NODE_ENV = 'production';
  delete process.env.SESSION_SECRET;
  delete process.env.SHOPIFY_API_SECRET;
  try {
    await assert.rejects(server.ssrLoadModule('/app/lib/accounts.server.ts'), /Set SESSION_SECRET or SHOPIFY_API_SECRET/);
  } finally {
    for (const [key, value] of [['NODE_ENV', previousEnv.nodeEnv], ['SESSION_SECRET', previousEnv.session], ['SHOPIFY_API_SECRET', previousEnv.shopify]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
  console.log('PASS: sheet URL allowlist, redirect blocking/limit, download size limits, CSV import limit, tenant isolation, settings parsing, HTML escaping, forwarded headers, and non-destructive invalid sync.');
} finally {
  globalThis.fetch = originalFetch;
  delete globalThis.prismaGlobal;
  await server.close();
}
