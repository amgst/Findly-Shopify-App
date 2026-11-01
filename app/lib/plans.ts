export const PLANS = {
  free: { name: "Free", limit: 10, monthlyPrice: 0 },
  starter: { name: "Starter", limit: 50, monthlyPrice: 5 },
  pro: { name: "Pro", limit: null, monthlyPrice: 9 },
} as const;
export type PlanHandle = keyof typeof PLANS;
export function isPlanHandle(value: unknown): value is PlanHandle {
  return value === "free" || value === "starter" || value === "pro";
}
export type BillingAccess = {
  plan: PlanHandle;
  name: string;
  limit: number | null;
  state: "verified" | "not_configured" | "unavailable";
  canAdd: boolean;
  manageUrl: string | null;
  trialEndsAt: string | null;
  cycleEndsAt: string | null;
  cancelAtEndOfCycle: boolean;
  verifiedAt: string | null;
  notice: string | null;
};
