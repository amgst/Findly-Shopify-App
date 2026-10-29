import type { ActionFunctionArgs, LinksFunction, LoaderFunctionArgs, MetaFunction } from "react-router";
import { redirect, useActionData, useLoaderData } from "react-router";
import { createUserSession, getWebAccountId, login } from "../lib/accounts.server";
import { rateLimit } from "../lib/rate-limit.server";
import { AuthForm, safeNext } from "../components/AuthForm";
import webStyles from "../components/web.css?url";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: webStyles }];
export const meta: MetaFunction = () => [{ title: "Log in – Pinpoint" }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const next = safeNext(new URL(request.url).searchParams.get("next"));
  if (await getWebAccountId(request)) throw redirect(next);
  return { next };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (!rateLimit(request, "login", 10, 10 * 60_000)) {
    return { error: "Too many attempts. Try again in a few minutes." };
  }
  const form = await request.formData();
  const r = await login(String(form.get("email") || ""), String(form.get("password") || ""));
  if ("error" in r) return { error: r.error };
  return createUserSession(r.account!.id, safeNext(String(form.get("next") || "")));
};

export default function Login() {
  const { next } = useLoaderData<typeof loader>();
  const data = useActionData<typeof action>();
  return <AuthForm mode="login" error={data?.error} next={next} />;
}
