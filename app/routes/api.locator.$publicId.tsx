// Public JSON API, for merchants who want to build their own front end.
import type { LoaderFunctionArgs } from "react-router";
import { getPublicLocator } from "../lib/locations.server";

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const data = await getPublicLocator(params.publicId || "");
  if (!data) return Response.json({ error: "Not found" }, { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
  return Response.json(data, {
    headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=60" },
  });
};
