// Widget analytics beacon (sent with navigator.sendBeacon as text/plain JSON).
import type { ActionFunctionArgs } from "react-router";
import { recordEvent } from "../lib/analytics.server";
import { rateLimit } from "../lib/rate-limit.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const loader = () => new Response(null, { status: 204, headers: CORS });

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (!rateLimit(request, "event", 120, 60_000)) return new Response(null, { status: 429, headers: CORS });
  try {
    const body = JSON.parse((await request.text()).slice(0, 2000));
    if (typeof body.id === "string" && typeof body.type === "string") {
      await recordEvent(body.id, body.type, {
        locationId: typeof body.locationId === "string" ? body.locationId : undefined,
        query: typeof body.query === "string" ? body.query : undefined,
      });
    }
  } catch {
    // Ignore malformed beacons
  }
  return new Response(null, { status: 204, headers: CORS });
};
