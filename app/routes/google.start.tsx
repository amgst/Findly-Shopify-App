import type { LoaderFunctionArgs } from "react-router";
import {
  startGoogleConnection,
  verifyGoogleTicket,
} from "../lib/google-sheets.server";
export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const locatorId = verifyGoogleTicket(
      new URL(request.url).searchParams.get("ticket") || "",
    );
    return await startGoogleConnection(locatorId);
  } catch {
    return new Response(
      "Connection link expired or invalid. Return to Locations and try again.",
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  }
};
