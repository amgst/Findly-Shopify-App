import { Link } from "react-router";
import { PLANS, type BillingAccess, type PlanHandle } from "../lib/plans";

export function PlansView({
  billing,
  used,
}: {
  billing: BillingAccess;
  used: number;
}) {
  return (
    <div className="ui">
      <div className="ui-card">
        <div className="ui-card-head">
          <div>
            <h2>
              {billing.state === "unavailable"
                ? "Last verified plan"
                : "Current plan"}
              : {billing.name}
            </h2>
            <p className="muted">
              {used}{" "}
              {billing.limit === null
                ? "saved locations · Unlimited allowance"
                : `of ${billing.limit} locations used`}
            </p>
          </div>
          <Link className="ui-btn" to="/app/plans?refresh=1">
            Refresh subscription
          </Link>
        </div>
        {billing.notice && (
          <p
            className={`ui-banner ${billing.state === "unavailable" ? "ui-banner-error" : "ui-banner-info"}`}
            role="status"
          >
            {billing.notice}
          </p>
        )}
        {billing.trialEndsAt && (
          <p>
            Trial ends:{" "}
            {new Date(billing.trialEndsAt).toLocaleDateString("en-US", {
              timeZone: "UTC",
            })}{" "}
            (UTC).
          </p>
        )}
        {billing.cancelAtEndOfCycle && (
          <p className="ui-banner ui-banner-info">
            Cancellation is scheduled. Current access continues until Shopify
            ends the subscription
            {billing.cycleEndsAt
              ? ` on ${new Date(billing.cycleEndsAt).toLocaleDateString("en-US", { timeZone: "UTC" })} (UTC)`
              : ""}
            .
          </p>
        )}
        {billing.limit !== null && used > billing.limit && (
          <p className="ui-banner ui-banner-info">
            You have more locations than this plan allows. All existing
            locations are kept. Edit or remove them, or choose a larger plan
            before adding more.
          </p>
        )}
        {billing.manageUrl && (
          <Link className="ui-btn ui-btn-primary" to="/app/billing">
            Manage subscription in Shopify
          </Link>
        )}
      </div>
      <div className="ui-grid ui-grid-3">
        {(Object.keys(PLANS) as PlanHandle[]).map((handle) => {
          const plan = PLANS[handle];
          return (
            <section className="ui-card" key={handle}>
              <div className="ui-card-head">
                <h2>{plan.name}</h2>
                {billing.plan === handle && (
                  <span className="ui-pill ui-pill-ok">
                    {billing.state === "unavailable"
                      ? "Last verified"
                      : "Current"}
                  </span>
                )}
              </div>
              <p className="ui-stat-value">
                {plan.monthlyPrice === 0 ? "Free" : `$${plan.monthlyPrice}`}{" "}
                {plan.monthlyPrice > 0 && (
                  <span className="small muted">/ month</span>
                )}
              </p>
              <p>
                <strong>
                  {plan.limit === null
                    ? "Unlimited locations"
                    : `Up to ${plan.limit} saved locations`}
                </strong>
              </p>
              <p className="muted small">
                Map themes, product and service filters, holiday hours, imports,
                and analytics.
              </p>
              {handle !== "free" && (
                <p className="muted small">
                  10-day trial when available. Shopify shows the final price,
                  trial eligibility, and billing terms before approval.
                </p>
              )}
            </section>
          );
        })}
      </div>
      <p className="muted small">
        Plan changes and cancellations are managed by Shopify. A return URL
        never unlocks access by itself: Findly checks the current subscription
        with Shopify. Subscription changes made elsewhere are normally checked
        within five minutes; Refresh subscription checks immediately.
      </p>
    </div>
  );
}
