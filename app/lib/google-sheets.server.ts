import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { createCookie, redirect } from "react-router";
import prisma from "../db.server";
import { normalizeSheetUrl } from "./sheet-fetch.server";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
export function googleReady() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY &&
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY.length >= 32 &&
    process.env.SHOPIFY_APP_URL &&
    (process.env.SESSION_SECRET || process.env.SHOPIFY_API_SECRET),
  );
}
function encryptionKey() {
  const secret = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!secret || secret.length < 32)
    throw new Error("Google token encryption is not configured.");
  return createHash("sha256").update(secret).digest();
}
export function encryptGoogleToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  return [
    iv.toString("base64url"),
    encrypted.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
}
export function decryptGoogleToken(token: string) {
  const [iv, encrypted, tag] = token.split(".");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
function stateCookie() {
  const secret = process.env.SESSION_SECRET || process.env.SHOPIFY_API_SECRET;
  if (!secret) throw new Error("Session signing is not configured.");
  return createCookie("findly_google_state", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/google/callback",
    maxAge: 600,
    secrets: [secret],
  });
}
function callbackUrl() {
  return new URL("/google/callback", process.env.SHOPIFY_APP_URL).toString();
}

// The authenticated iframe creates a short-lived ticket. A new tab exchanges it for
// a first-party OAuth state cookie, so Google login never runs inside Shopify's iframe.
function ticketSignature(payload: string) {
  const secret = process.env.SESSION_SECRET || process.env.SHOPIFY_API_SECRET;
  if (!secret) throw new Error("Session signing is not configured.");
  return createHmac("sha256", secret)
    .update(`google-connect:${payload}`)
    .digest();
}
export function googleConnectionUrl(locatorId: string) {
  if (!googleReady()) throw new Error("Google connections are not configured.");
  const payload = Buffer.from(
    JSON.stringify({ locatorId, expires: Date.now() + 120000 }),
  ).toString("base64url");
  const ticket = `${payload}.${ticketSignature(payload).toString("base64url")}`;
  return new URL(
    `/google/start?ticket=${encodeURIComponent(ticket)}`,
    process.env.SHOPIFY_APP_URL,
  ).toString();
}
export function verifyGoogleTicket(ticket: string) {
  const [payload, signature] = ticket.split(".");
  if (!payload || !signature) throw new Error("Invalid connection ticket.");
  const actual = Buffer.from(signature, "base64url");
  const expected = ticketSignature(payload);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new Error("Invalid connection ticket.");
  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (
    typeof data.locatorId !== "string" ||
    typeof data.expires !== "number" ||
    data.expires < Date.now()
  )
    throw new Error("Connection ticket expired.");
  return data.locatorId as string;
}

export async function startGoogleConnection(locatorId: string) {
  if (!googleReady())
    throw new Response(
      "Google connections are not configured. Set up Google OAuth in the app environment first.",
      { status: 503 },
    );
  encryptionKey();
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: callbackUrl(),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  });
  return redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, {
    headers: {
      "Set-Cookie": await stateCookie().serialize({
        state,
        locatorId,
        verifier,
        expires: Date.now() + 600000,
      }),
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
export async function finishGoogleConnection(request: Request) {
  const url = new URL(request.url);
  const cookie = stateCookie();
  const state = await cookie.parse(request.headers.get("Cookie"));
  const headers = {
    "Set-Cookie": await cookie.serialize("", { maxAge: 0 }),
    "Cache-Control": "no-store",
  };
  if (
    !state ||
    typeof state.state !== "string" ||
    state.state !== url.searchParams.get("state") ||
    state.expires < Date.now()
  ) {
    return new Response(
      "Connection expired or invalid. Return to Locations and connect Google again.",
      { status: 400, headers },
    );
  }
  if (url.searchParams.has("error"))
    return new Response(
      "Google connection was cancelled. You can close this tab and keep using CSV upload.",
      { status: 400, headers },
    );
  const code = url.searchParams.get("code");
  if (!code)
    return new Response("Missing authorization code.", {
      status: 400,
      headers,
    });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: callbackUrl(),
      grant_type: "authorization_code",
      code_verifier: state.verifier,
    }),
  });
  const tokens = (await response.json()) as {
    refresh_token?: string;
    scope?: string;
  };
  if (
    !response.ok ||
    !tokens.refresh_token ||
    !tokens.scope?.split(" ").includes(SCOPE)
  )
    return new Response(
      "Google did not grant offline Sheets access. Return to Locations and try connecting again.",
      { status: 400, headers },
    );
  await prisma.locator.update({
    where: { id: state.locatorId },
    data: {
      googleRefreshToken: encryptGoogleToken(tokens.refresh_token),
      googleConnectedAt: new Date(),
    },
  });
  return new Response(
    "Google Sheets connected. Close this tab, refresh Locations, and paste your private sheet link. Your sheet can remain private.",
    { headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } },
  );
}
export async function disconnectGoogle(locatorId: string) {
  const locator = await prisma.locator.findUnique({
    where: { id: locatorId },
    select: { googleRefreshToken: true },
  });
  if (locator?.googleRefreshToken) {
    const token = decryptGoogleToken(locator.googleRefreshToken);
    const response = await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok && response.status !== 400)
      throw new Error("Could not revoke Google access. Try again.");
  }
  // Stop scheduled sync and retain imported rows.
  await prisma.locator.update({
    where: { id: locatorId },
    data: {
      googleRefreshToken: null,
      googleConnectedAt: null,
      sheetUrl: null,
      sheetSyncedAt: null,
    },
  });
}

export async function fetchPrivateSheetCsv(
  sheetUrl: string,
  encryptedToken: string,
) {
  const normalized = new URL(normalizeSheetUrl(sheetUrl));
  const id = normalized.pathname.match(/^\/spreadsheets\/d\/([\w-]+)/)?.[1];
  if (!id || id === "e")
    throw new Error(
      "Use the original sheet link for a private connection, not a published link.",
    );
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: decryptGoogleToken(encryptedToken),
    }),
  });
  const tokenData = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenResponse.ok || !tokenData.access_token)
    throw new Error(
      "Google access expired or was revoked. Reconnect Google in Locations.",
    );
  const headers = { Authorization: `Bearer ${tokenData.access_token}` };
  const metadata = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}?fields=sheets.properties`,
    { headers, signal: AbortSignal.timeout(15000), redirect: "error" },
  );
  if (!metadata.ok)
    throw new Error(
      "Google cannot read this private sheet. Check the connected Google account has access.",
    );
  const info = (await metadata.json()) as {
    sheets?: { properties: { sheetId: number; title: string } }[];
  };
  const gid = normalized.searchParams.get("gid");
  const sheet =
    gid === null
      ? info.sheets?.[0]
      : info.sheets?.find((item) => String(item.properties.sheetId) === gid);
  if (!sheet) throw new Error("The selected sheet tab was not found.");
  const range = `'${sheet.properties.title.replace(/'/g, "''")}'!A1:AZ10002`;
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values/${encodeURIComponent(range)}`,
    { headers, signal: AbortSignal.timeout(15000), redirect: "error" },
  );
  if (!response.ok)
    throw new Error("Google could not download the selected sheet tab.");
  // Bound streamed API responses as well as the CSV import result.
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Google returned no data.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 5 * 1024 * 1024)
        throw new Error("Sheets are limited to 5 MB.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  const data = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
    values?: string[][];
  };
  if (!data.values?.length) throw new Error("The selected sheet tab is empty.");
  // API values are already plain text; don't apply spreadsheet export formula escaping.
  return data.values
    .map((row) =>
      row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
    )
    .join("\r\n");
}
