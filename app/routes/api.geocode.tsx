// Place search for the widget's search box (proxied so we can cache + rate limit).
import type { LoaderFunctionArgs } from "react-router";
import { searchPlaces } from "../lib/geocode.server";
import { rateLimit } from "../lib/rate-limit.server";

const CORS = { "Access-Control-Allow-Origin": "*" };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().slice(0, 120);
  const lang = url.searchParams.get("lang") || undefined;
  if (q.length < 2) return Response.json({ results: [] }, { headers: CORS });
  if (!rateLimit(request, "geocode", 60, 60_000)) {
    return Response.json({ results: [], error: "rate_limited" }, { status: 429, headers: CORS });
  }
  try {
    const results = await searchPlaces(q, lang);
    return Response.json({ results }, { headers: { ...CORS, "Cache-Control": "public, max-age=3600" } });
  } catch (e) {
    console.error("geocode", e);
    return Response.json({ results: [] }, { status: 502, headers: CORS });
  }
};
