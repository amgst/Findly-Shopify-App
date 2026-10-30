import { createCookieSessionStorage, redirect } from "react-router";
import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import prisma from "../db.server";
import { DEFAULT_SETTINGS } from "./settings";

const scrypt = promisify(_scrypt) as (
  pw: string,
  salt: string,
  len: number,
) => Promise<Buffer>;

export function newPublicId() {
  return randomBytes(9).toString("base64url");
}

async function ensureLocator(accountId: string) {
  return prisma.locator.upsert({
    where: { accountId },
    update: {},
    create: {
      accountId,
      publicId: newPublicId(),
      settings: JSON.stringify(DEFAULT_SETTINGS),
    },
  });
}

// ---------- Shopify merchants ----------

export async function getShopAccount(shop: string) {
  const account = await prisma.account.upsert({
    where: { shop },
    create: { shop, name: shop.replace(".myshopify.com", "") },
    update: {},
  });
  const locator = await ensureLocator(account.id);
  return { account, locator };
}

// ---------- Web (non-Shopify) users ----------

const configuredSecret =
  process.env.SESSION_SECRET ||
  process.env.SHOPIFY_API_SECRET;

if (!configuredSecret && process.env.NODE_ENV === "production") {
  throw new Error("Set SESSION_SECRET or SHOPIFY_API_SECRET before starting in production.");
}
const SESSION_SECRET = configuredSecret || randomBytes(32).toString("hex");

const webSession = createCookieSessionStorage({
  cookie: {
    name: "__findly",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    secrets: [SESSION_SECRET],
    maxAge: 60 * 60 * 24 * 30,
  },
});

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, hex] = stored.split(":");
  if (!salt || !hex) return false;
  const key = await scrypt(password, salt, 64);
  const expected = Buffer.from(hex, "hex");
  return expected.length === key.length && timingSafeEqual(key, expected);
}

export async function signup(email: string, password: string, name: string) {
  email = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password.length > 1024 || email.length > 254 || name.length > 120) {
    return { error: "Email, name, or password is too long." };
  }
  const exists = await prisma.account.findUnique({ where: { email } });
  if (exists) return { error: "An account with that email already exists." };
  const account = await prisma.account.create({
    data: { email, name: name.trim() || null, passwordHash: await hashPassword(password) },
  });
  await ensureLocator(account.id);
  return { account };
}

export async function login(email: string, password: string) {
  if (email.length > 254 || password.length > 1024) return { error: "Incorrect email or password." };
  const account = await prisma.account.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!account?.passwordHash || !(await verifyPassword(password, account.passwordHash))) {
    return { error: "Incorrect email or password." };
  }
  return { account };
}

export async function createUserSession(accountId: string, redirectTo: string) {
  const session = await webSession.getSession();
  session.set("accountId", accountId);
  return redirect(redirectTo, {
    headers: { "Set-Cookie": await webSession.commitSession(session) },
  });
}

export async function logout(request: Request) {
  const session = await webSession.getSession(request.headers.get("Cookie"));
  return redirect("/", {
    headers: { "Set-Cookie": await webSession.destroySession(session) },
  });
}

export async function getWebAccountId(request: Request): Promise<string | null> {
  const session = await webSession.getSession(request.headers.get("Cookie"));
  const id = session.get("accountId");
  return typeof id === "string" ? id : null;
}

/** For /dashboard routes: returns the signed-in web account or redirects to /login. */
export async function requireWebAccount(request: Request) {
  const id = await getWebAccountId(request);
  const account = id ? await prisma.account.findUnique({ where: { id } }) : null;
  if (!account || account.shop) {
    const url = new URL(request.url);
    throw redirect(`/login?next=${encodeURIComponent(url.pathname)}`);
  }
  const locator = await ensureLocator(account.id);
  return { account, locator };
}
