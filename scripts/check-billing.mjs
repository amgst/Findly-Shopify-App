/* eslint-env node */
/* global globalThis */
import assert from "node:assert/strict";
import { createServer } from "vite";
const oldFetch = globalThis.fetch;
const oldPrisma = globalThis.prismaGlobal;
const names = [
  "SHOPIFY_PARTNER_ORG_ID",
  "SHOPIFY_PARTNER_API_ACCESS_TOKEN",
  "SHOPIFY_APP_GID",
  "SHOPIFY_APP_HANDLE",
];
const previous = Object.fromEntries(
  names.map((key) => [key, process.env[key]]),
);
Object.assign(process.env, {
  SHOPIFY_PARTNER_ORG_ID: "123",
  SHOPIFY_PARTNER_API_ACCESS_TOKEN: "test-token",
  SHOPIFY_APP_GID: "gid://shopify/App/456",
  SHOPIFY_APP_HANDLE: "findly-store-finder",
});
const makeAccount = () => ({
  id: "account-a",
  shop: "test-shop.myshopify.com",
  shopGid: "gid://shopify/Shop/789",
  plan: "free",
  planVerifiedAt: null,
  planHasSubscription: false,
  planTrialEndsAt: null,
  planCycleEndsAt: null,
  planCancelAtEnd: false,
});
let account = makeAccount();
let calls = 0;
let updates = 0;
const subscription = (handle, extra = {}) => ({
  shop: { id: account.shopGid, myshopifyDomain: account.shop },
  items: [{ handle, price: { __typename: "FlatRatePrice" } }],
  trialEndsAt: null,
  cancelAtEndOfCycle: false,
  currentBillingCycle: {
    endTime: new Date(Date.now() + 86400000).toISOString(),
  },
  ...extra,
});
let live = null;
let failure = null;
globalThis.fetch = async (url, options) => {
  calls++;
  assert.equal(
    String(url),
    "https://partners.shopify.com/123/api/2026-10/graphql.json",
  );
  assert.equal(options.headers["X-Shopify-Access-Token"], "test-token");
  const body = JSON.parse(options.body);
  assert.equal(body.variables.appId, process.env.SHOPIFY_APP_GID);
  assert.equal(body.variables.shopId, account.shopGid);
  assert.ok(
    !body.query.includes("pendingUpdate"),
    "pending plans must not grant early access",
  );
  if (failure === "timeout") throw new Error("timeout");
  if (failure === "throttle")
    return Response.json(
      { errors: [{ message: "Too many requests" }] },
      { status: 429 },
    );
  if (failure === "graphql")
    return Response.json({ errors: [{ message: "Unauthorized" }] });
  return Response.json({ data: { activeSubscription: live } });
};
globalThis.prismaGlobal = {
  account: {
    updateMany: async ({ where, data }) => { assert.equal(where.shop, account.shop); account = { ...account, ...data }; return { count: 1 }; },
    update: async ({ where, data }) => {
      assert.equal(where.id, account.id);
      updates++;
      account = { ...account, ...data };
      return account;
    },
  },
  locator: { findUnique: async () => ({ account }) },
};
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "silent",
});
try {
  const billing = await server.ssrLoadModule("/app/lib/billing.server.ts");
  const limits = await server.ssrLoadModule("/app/lib/location-limit.ts");
  assert.equal(
    billing.planSelectionUrl(account.shop),
    "https://admin.shopify.com/store/test-shop/charges/findly-store-finder/pricing_plans",
  );
  assert.equal(billing.planSelectionUrl("https://evil.test"), null);
  let result = await billing.getAccountBilling(account, true);
  assert.equal(result.limit, 10);
  assert.equal(result.plan, "free");
  live = subscription("starter");
  result = await billing.getAccountBilling(account, true);
  assert.equal(result.limit, 50);
  const beforeCache = calls;
  result = await billing.getAccountBilling(account);
  assert.equal(calls, beforeCache);
  assert.equal(result.plan, "starter");
  live = subscription("pro");
  result = await billing.getAccountBilling(account, true);
  assert.equal(result.limit, null);
  assert.equal(result.plan, "pro");
  live = subscription("pro", {
    trialEndsAt: new Date(Date.now() + 86400000).toISOString(),
    currentBillingCycle: null,
  });
  result = await billing.getAccountBilling(account, true);
  assert.equal(result.limit, null);
  assert.ok(result.trialEndsAt);
  live = subscription("pro", { cancelAtEndOfCycle: true });
  result = await billing.getAccountBilling(account, true);
  assert.equal(result.limit, null);
  assert.equal(result.cancelAtEndOfCycle, true);
  live = null;
  result = await billing.getAccountBilling(account, true);
  assert.equal(result.limit, 10);
  assert.equal(result.cancelAtEndOfCycle, false);
  account = {
    ...account,
    plan: "pro",
    planVerifiedAt: null,
    planHasSubscription: false,
  };
  result = await billing.getAccountBilling(account);
  assert.equal(
    result.limit,
    10,
    "an unverified local plan value cannot grant paid access",
  );
  live = subscription("pro");
  await billing.getAccountBilling(account, true);
  for (const mode of ["throttle", "graphql", "timeout"]) {
    failure = mode;
    const previousUpdates = updates;
    await assert.rejects(
      billing.getAccountBilling(account, true),
      billing.BillingVerificationError,
    );
    assert.equal(updates, previousUpdates);
    assert.equal(
      account.plan,
      "pro",
      "failed requests must not overwrite a verified paid plan",
    );
  }
  failure = "throttle";
  account = { ...account, planVerifiedAt: new Date(Date.now() - 3600000) };
  result = await billing.getLocatorBilling("locator-a", true, true);
  assert.equal(result.state, "unavailable");
  assert.equal(result.canAdd, false);
  assert.equal(result.plan, "pro");
  await assert.rejects(
    billing.getLocatorBilling("locator-a", true),
    billing.BillingVerificationError,
  );
  failure = null;
  live = subscription("unknown");
  await assert.rejects(
    billing.getAccountBilling(account, true),
    billing.BillingVerificationError,
  );
  live = subscription("pro", {
    shop: {
      id: "gid://shopify/Shop/000",
      myshopifyDomain: "other.myshopify.com",
    },
  });
  await assert.rejects(
    billing.getAccountBilling(account, true),
    billing.BillingVerificationError,
  );
  live = subscription("pro", {
    items: [
      { handle: "starter", price: { __typename: "FlatRatePrice" } },
      { handle: "pro", price: { __typename: "FlatRatePrice" } },
    ],
  });
  await assert.rejects(
    billing.getAccountBilling(account, true),
    billing.BillingVerificationError,
  );
  live = subscription("starter");
  const beforeCoalesce = calls;
  await Promise.all([
    billing.getAccountBilling(account, true),
    billing.getAccountBilling(account, true),
  ]);
  assert.equal(calls, beforeCoalesce + 1);
  account = {
    ...account,
    plan: "pro",
    planHasSubscription: true,
    planVerifiedAt: new Date(),
    planTrialEndsAt: new Date(Date.now() - 1000),
  };
  live = null;
  result = await billing.getAccountBilling(account);
  assert.equal(
    result.plan,
    "free",
    "trial boundaries must force a recheck rather than extending cached access",
  );
  delete process.env.SHOPIFY_PARTNER_API_ACCESS_TOKEN;
  account = makeAccount();
  result = await billing.getAccountBilling(account);
  assert.equal(result.plan, "free");
  assert.equal(result.manageUrl, null);
  assert.equal(result.state, "not_configured");
  account = { ...account, plan: "pro", planVerifiedAt: new Date() };
  await assert.rejects(
    billing.getAccountBilling(account),
    billing.BillingVerificationError,
  );
  const existing = Array.from({ length: 50 }, (_, id) => ({
    source: "csv",
    externalId: String(id),
  }));
  assert.throws(
    () =>
      limits.checkLocationCapacity(
        existing,
        [{ source: "csv", externalId: "new" }],
        undefined,
        50,
      ),
    limits.LocationLimitError,
  );
  assert.doesNotThrow(() =>
    limits.checkLocationCapacity(
      existing,
      [{ source: "csv", externalId: "new" }],
      undefined,
      null,
    ),
  );
  const unavailable = new billing.BillingVerificationError();
  assert.throws(
    () =>
      limits.checkLocationCapacity(
        existing,
        [{ source: "csv", externalId: "new" }],
        undefined,
        unavailable,
      ),
    billing.BillingVerificationError,
  );
  assert.doesNotThrow(
    () =>
      limits.checkLocationCapacity(
        existing,
        [existing[0]],
        undefined,
        unavailable,
      ),
    "existing rows remain editable while verification is unavailable",
  );
  await billing.invalidateShopBilling(account.shop);
  assert.equal(account.plan, 'free'); assert.equal(account.planVerifiedAt, null); assert.equal(account.planHasSubscription, false);
  console.log(
    "PASS: Free 10, Starter 50, Pro unlimited; verified trials; cancellation/end-of-cycle; cache and forced refresh; API failures preserve plan without authorizing new writes; unknown/cross-shop plans rejected; forged local plans rejected; missing configuration fails safely; request coalescing; paid-cap and unlimited-cap checks.",
  );
} finally {
  globalThis.fetch = oldFetch;
  if (oldPrisma === undefined) delete globalThis.prismaGlobal;
  else globalThis.prismaGlobal = oldPrisma;
  for (const key of names) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }
  await server.close();
}
