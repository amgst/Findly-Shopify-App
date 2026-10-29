// Scheduled jobs for serverless hosts (Vercel Cron calls this; see vercel.json).
// Looks up addresses still waiting for map coordinates and syncs due Google Sheets.
import type { LoaderFunctionArgs } from "react-router";
import { processPending } from "../lib/geocode.server";
import { syncDueSheets } from "../lib/jobs.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Vercel sends "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is set.
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const started = Date.now();
  await syncDueSheets();
  // ~1 lookup per second (Nominatim policy); stay well inside the function time limit.
  await processPending(60);
  return Response.json({ ok: true, ms: Date.now() - started });
};
