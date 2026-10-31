/* eslint-env node */
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
try {
  const { embeddedAppEntry } = await server.ssrLoadModule('/app/lib/app-entry.server.ts');
  for (const query of ['shop=example.myshopify.com', 'host=encoded-host', 'embedded=1', 'id_token=token', 'shop=example.myshopify.com&host=encoded-host&embedded=1&locale=en']) {
    assert.equal(embeddedAppEntry(new Request(`https://app.test/?${query}`)), `/app?${query}`);
  }
  assert.equal(embeddedAppEntry(new Request('https://app.test/')), null);
  assert.equal(embeddedAppEntry(new Request('https://app.test/?utm_source=search')), null);
  assert.equal(embeddedAppEntry(new Request('https://app.test/?embedded=0')), null);
  console.log('PASS: Shopify launches reach /app with launch parameters preserved; public website visits stay on the landing page.');
} finally { await server.close(); }
