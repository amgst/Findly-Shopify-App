import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { logout } from "../lib/accounts.server";

export const loader = () => redirect("/");
export const action = ({ request }: ActionFunctionArgs) => logout(request);
