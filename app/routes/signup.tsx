import type { ActionFunctionArgs, LinksFunction, LoaderFunctionArgs, MetaFunction } from "react-router";
import { redirect, useActionData } from "react-router";
import { createUserSession, getWebAccountId, signup } from "../lib/accounts.server";
import { rateLimit } from "../lib/rate-limit.server";
import { AuthForm } from "../components/AuthForm";
import webStyles from "../components/web.css?url";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: webStyles }];
export const meta: MetaFunction = () => [{ title: "Create your store locator – Findly" }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (await getWebAccountId(request)) throw redirect("/dashboard");
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (!rateLimit(request, "signup", 5, 60 * 60_000)) {
    return { error: "Too many sign-ups from this network. Try again later." };
  }
  const form = await request.formData();
  const r = await signup(
    String(form.get("email") || ""),
    String(form.get("password") || ""),
    String(form.get("name") || ""),
  );
  if ("error" in r) return { error: r.error };
  return createUserSession(r.account!.id, "/dashboard");
};

export default function Signup() {
  const data = useActionData<typeof action>();
  return <AuthForm mode="signup" error={data?.error} next="/dashboard" />;
}
