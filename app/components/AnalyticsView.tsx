import type { Stats } from "../lib/analytics.server";

export function AnalyticsView({ stats }: { stats: Stats }) {
  const max = Math.max(1, ...stats.viewsByDay.map((d) => d.count));
  const cards: [string, number][] = [
    ["Locator views", stats.totals.view],
    ["Searches", stats.totals.search],
    ["Location views", stats.totals.location_view],
    ["Directions requests", stats.totals.directions],
    ["Link clicks", stats.totals.link_click],
  ];
  return (
    <div className="ui">
      <p className="muted" style={{ marginBottom: 12 }}>
        Last {stats.days} days
      </p>
      <div className="ui-grid ui-grid-4" style={{ marginBottom: 16 }}>
        {cards.map(([label, value]) => (
          <div className="ui-stat" key={label}>
            <div className="ui-stat-label">{label}</div>
            <div className="ui-stat-value">{value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="ui-card">
        <h2 style={{ marginBottom: 12 }}>Views per day</h2>
        <div className="ui-bars" role="img" aria-label="Locator views per day">
          {stats.viewsByDay.map((d) => (
            <div
              key={d.date}
              title={`${d.date}: ${d.count} views`}
              style={{ height: `${(d.count / max) * 100}%` }}
            />
          ))}
        </div>
        <div className="ui-row muted small" style={{ marginTop: 6 }}>
          <span>{stats.viewsByDay[0]?.date}</span>
          <span className="ui-spacer" />
          <span>{stats.viewsByDay[stats.viewsByDay.length - 1]?.date}</span>
        </div>
      </div>

      <div className="ui-grid ui-grid-2">
        <div className="ui-card">
          <h2 style={{ marginBottom: 12 }}>Top searches</h2>
          {stats.topSearches.length === 0 ? (
            <p className="muted">No searches yet.</p>
          ) : (
            <table className="ui-table">
              <tbody>
                {stats.topSearches.map((s) => (
                  <tr key={s.query}>
                    <td>{s.query}</td>
                    <td style={{ textAlign: "right" }}>{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="ui-card">
          <h2 style={{ marginBottom: 12 }}>Top locations</h2>
          {stats.topLocations.length === 0 ? (
            <p className="muted">No location views yet.</p>
          ) : (
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Location</th>
                  <th style={{ textAlign: "right" }}>Views</th>
                  <th style={{ textAlign: "right" }}>Directions</th>
                </tr>
              </thead>
              <tbody>
                {stats.topLocations.map((l) => (
                  <tr key={l.id}>
                    <td>{l.name}</td>
                    <td style={{ textAlign: "right" }}>{l.views}</td>
                    <td style={{ textAlign: "right" }}>{l.directions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
