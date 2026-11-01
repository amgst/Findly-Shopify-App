import type { Account } from "@prisma/client";
import prisma from "../db.server";
import {
  PLANS,
  isPlanHandle,
  type BillingAccess,
  type PlanHandle,
} from "./plans";

export const PARTNER_API_VERSION = "2026-10";
export const ACTIVE_SUBSCRIPTION_QUERY = `query FindlyActiveSubscription($appId: ID!, $shopId: ID!) {
  activeSubscription(appId: $appId, shopId: $shopId) {
    shop { id myshopifyDomain }
    items { handle price { __typename } }
    trialEndsAt
    cancelAtEndOfCycle
    currentBillingCycle { endTime }
  }
}`;
export const BILLING_SHOP_QUERY = `query FindlyBillingShop { shop { id myshopifyDomain } }`;
const CACHE_MS = 5 * 60 * 1000;
const pending = new Map<string, Promise<BillingAccess>>();
let nextRequestAt = 0;

export class BillingVerificationError extends Error {
  constructor(
    message = "We could not verify your Shopify subscription. Existing locations are kept and remain editable. Try refreshing your subscription before adding locations.",
  ) {
    super(message);
    this.name = "BillingVerificationError";
  }
}
export function billingReady() {
  return Boolean(
    /^\d+$/.test(process.env.SHOPIFY_PARTNER_ORG_ID || "") &&
    process.env.SHOPIFY_PARTNER_API_ACCESS_TOKEN &&
    /^gid:\/\/shopify\/App\/\d+$/.test(process.env.SHOPIFY_APP_GID || ""),
  );
}
export function planSelectionUrl(shop: string | null) {
  const handle = process.env.SHOPIFY_APP_HANDLE;
  if (
    !shop ||
    !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop) ||
    !handle ||
    !/^[a-z0-9][a-z0-9-]*$/.test(handle)
  )
    return null;
  return `https://admin.shopify.com/store/${shop.slice(0, -".myshopify.com".length)}/charges/${handle}/pricing_plans`;
}
function access(
  account: Account,
  plan: PlanHandle,
  state: BillingAccess["state"],
  notice: string | null = null,
): BillingAccess {
  return {
    plan,
    name: PLANS[plan].name,
    limit: PLANS[plan].limit,
    state,
    canAdd: state !== "unavailable",
    manageUrl: billingReady() ? planSelectionUrl(account.shop) : null,
    trialEndsAt: account.planTrialEndsAt?.toISOString() || null,
    cycleEndsAt: account.planCycleEndsAt?.toISOString() || null,
    cancelAtEndOfCycle: account.planCancelAtEnd || false,
    verifiedAt: account.planVerifiedAt?.toISOString() || null,
    notice,
  };
}
function date(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    throw new BillingVerificationError();
  return new Date(value);
}
export type ActiveSubscription = {
  shop: { id: string; myshopifyDomain: string };
  items: { handle: string | null; price: { __typename: string } }[];
  trialEndsAt: string | null;
  cancelAtEndOfCycle: boolean;
  currentBillingCycle: { endTime: string } | null;
};
export function subscriptionPlan(
  subscription: ActiveSubscription | null,
): PlanHandle {
  if (subscription === null) return "free";
  if (!subscription || !Array.isArray(subscription.items))
    throw new BillingVerificationError();
  // Only current recurring plan items grant access; pending updates never grant it early.
  const handles = [
    ...new Set(
      subscription.items
        .filter((item) => item.price?.__typename === "FlatRatePrice")
        .map((item) => item.handle)
        .filter(isPlanHandle),
    ),
  ];
  if (handles.length !== 1)
    throw new BillingVerificationError(
      "Your Shopify subscription plan is not recognized. Contact support before adding locations.",
    );
  return handles[0];
}
async function shopId(account: Account) {
  if (account.shopGid && /^gid:\/\/shopify\/Shop\/\d+$/.test(account.shopGid))
    return account.shopGid;
  const { unauthenticated } = await import("../shopify.server");
  const { admin } = await unauthenticated.admin(account.shop!);
  const response = await admin.graphql(BILLING_SHOP_QUERY);
  const json = (await response.json()) as {
    data?: { shop?: { id: string; myshopifyDomain: string } };
    errors?: unknown[];
  };
  const shop = json.data?.shop;
  if (
    !response.ok ||
    json.errors?.length ||
    !shop ||
    shop.myshopifyDomain !== account.shop ||
    !/^gid:\/\/shopify\/Shop\/\d+$/.test(shop.id)
  )
    throw new BillingVerificationError();
  await prisma.account.update({
    where: { id: account.id },
    data: { shopGid: shop.id },
  });
  return shop.id as string;
}
async function verify(account: Account): Promise<BillingAccess> {
  try {
    const id = await shopId(account);
    // Stay below the Partner client's four-requests-per-second limit in this process.
    const now = Date.now();
    const slot = Math.max(now, nextRequestAt);
    if (slot - now > 1500) throw new BillingVerificationError();
    nextRequestAt = slot + 300;
    if (slot > now)
      await new Promise((resolve) => setTimeout(resolve, slot - now));
    const response = await fetch(
      `https://partners.shopify.com/${process.env.SHOPIFY_PARTNER_ORG_ID}/api/${PARTNER_API_VERSION}/graphql.json`,
      {
        method: "POST",
        signal: AbortSignal.timeout(12000),
        redirect: "error",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token":
            process.env.SHOPIFY_PARTNER_API_ACCESS_TOKEN!,
        },
        body: JSON.stringify({
          query: ACTIVE_SUBSCRIPTION_QUERY,
          variables: { appId: process.env.SHOPIFY_APP_GID, shopId: id },
        }),
      },
    );
    const json = await response.json();
    if (
      !response.ok ||
      json.errors?.length ||
      !json.data ||
      !("activeSubscription" in json.data)
    )
      throw new BillingVerificationError();
    const subscription = json.data
      .activeSubscription as ActiveSubscription | null;
    if (
      subscription !== null &&
      (subscription.shop?.id !== id ||
        subscription.shop?.myshopifyDomain !== account.shop ||
        typeof subscription.cancelAtEndOfCycle !== "boolean")
    )
      throw new BillingVerificationError();
    const plan = subscriptionPlan(subscription);
    const data = {
      plan,
      planVerifiedAt: new Date(),
      planHasSubscription: !!subscription,
      planTrialEndsAt: date(subscription?.trialEndsAt),
      planCycleEndsAt: date(subscription?.currentBillingCycle?.endTime),
      planCancelAtEnd: subscription?.cancelAtEndOfCycle || false,
    };
    // An uninstall invalidates in-flight checks as well as cached checks.
    const saved = await prisma.account.updateMany({
      where: { id: account.id, billingRevision: account.billingRevision },
      data,
    });
    if (saved.count !== 1) throw new BillingVerificationError();
    return access({ ...account, ...data }, plan, "verified");
  } catch (error) {
    if (error instanceof BillingVerificationError) throw error;
    // Never interpret a timeout, revoked token, or throttle as a confirmed cancellation.
    throw new BillingVerificationError();
  }
}
export async function getAccountBilling(
  account: Account,
  force = false,
): Promise<BillingAccess> {
  if (!account.shop) return access(account, "free", "not_configured");
  if (!billingReady()) {
    if (account.planVerifiedAt && account.plan !== "free")
      throw new BillingVerificationError();
    return access(
      account,
      "free",
      "not_configured",
      "Paid subscriptions are not connected yet. You can use the free 10-location allowance.",
    );
  }
  const now = Date.now();
  const existing = pending.get(account.id);
  if (existing) return existing;
  const verified = account.planVerifiedAt?.getTime();
  const boundary = [account.planTrialEndsAt, account.planCycleEndsAt]
    .filter((value): value is Date => !!value)
    .map((value) => value.getTime());
  if (
    !force &&
    account.planHasSubscription &&
    verified &&
    now >= verified &&
    now - verified < CACHE_MS &&
    boundary.every((end) => end > now) &&
    isPlanHandle(account.plan)
  )
    return access(account, account.plan, "verified");
  const promise = verify(account);
  pending.set(account.id, promise);
  try {
    return await promise;
  } finally {
    if (pending.get(account.id) === promise) pending.delete(account.id);
  }
}

export async function invalidateShopBilling(shop: string) {
  await prisma.account.updateMany({
    where: { shop },
    data: {
      plan: "free",
      planVerifiedAt: null,
      planHasSubscription: false,
      planTrialEndsAt: null,
      planCycleEndsAt: null,
      planCancelAtEnd: false,
      billingRevision: { increment: 1 },
    },
  });
}
export async function getLocatorBilling(
  locatorId: string,
  force = false,
  displayOnly = false,
): Promise<BillingAccess> {
  const locator = await prisma.locator.findUnique({
    where: { id: locatorId },
    select: { account: true },
  });
  if (!locator) throw new Response("Locator not found", { status: 404 });
  try {
    return await getAccountBilling(locator.account, force);
  } catch (error) {
    if (!displayOnly || !(error instanceof BillingVerificationError))
      throw error;
    const plan =
      locator.account.planVerifiedAt && isPlanHandle(locator.account.plan)
        ? locator.account.plan
        : "free";
    return access(locator.account, plan, "unavailable", error.message);
  }
}
