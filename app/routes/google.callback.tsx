import type { LoaderFunctionArgs } from "react-router";
import { finishGoogleConnection } from "../lib/google-sheets.server";
export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    return await finishGoogleConnection(request);
  } catch {
    return new Response(
      "Google connection failed. Return to Locations and try again.",
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
};
