export type ActionResult = { ok?: string; error?: string };

export function Flash({ data }: { data?: ActionResult }) {
  if (!data) return null;
  if (data.error) return <div className="ui-banner ui-banner-error" role="alert">{data.error}</div>;
  if (data.ok) return <div className="ui-banner ui-banner-ok" role="status">{data.ok}</div>;
  return null;
}
