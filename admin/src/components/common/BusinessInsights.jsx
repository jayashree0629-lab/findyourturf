import { IconTicket, IconUsers, IconAward, IconBell } from "./Icons";
import { money } from "./adminUi";

function Tile({ icon: Icon, label, value, hint, tone = "#2563eb", onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      className="card"
      onClick={onClick}
      style={{ padding: "14px 16px", textAlign: "left", cursor: onClick ? "pointer" : "default", display: "flex", gap: 12, alignItems: "center" }}
    >
      <span style={{ width: 40, height: 40, borderRadius: 12, background: `${tone}1a`, color: tone, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
        <Icon size={20} />
      </span>
      <span>
        <span style={{ display: "block", fontSize: 12, color: "#64748b", fontWeight: 600 }}>{label}</span>
        <span style={{ display: "block", fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>{value}</span>
        {hint && <span style={{ display: "block", fontSize: 11.5, color: "#94a3b8" }}>{hint}</span>}
      </span>
    </Tag>
  );
}

function WeekBars({ week }) {
  const max = Math.max(1, ...week.map((d) => d.revenue));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 130, paddingTop: 8 }} role="img" aria-label="Revenue for the last 7 days">
      {week.map((d) => {
        const h = Math.max(d.revenue > 0 ? 8 : 3, Math.round((d.revenue / max) * 100));
        const label = new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });
        return (
          <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }} title={`${d.date}: ${money(d.revenue)} · ${d.bookings} bookings`}>
            <span style={{ fontSize: 10.5, color: "#64748b", fontWeight: 600 }}>{d.revenue > 0 ? money(d.revenue) : ""}</span>
            <div style={{ width: "100%", height: `${h}%`, minHeight: 3, background: d.revenue > 0 ? "linear-gradient(180deg,#60a5fa,#2563eb)" : "#e2e8f0", borderRadius: 6 }} />
            <span style={{ fontSize: 11, color: "#94a3b8" }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function BusinessInsights({ data, error, onNavigate }) {
  if (error) {
    return (
      <div className="alert-banner error" style={{ marginBottom: 16 }}>
        <span>Business summary unavailable: {error}</span>
      </div>
    );
  }
  if (!data) {
    return <div className="card" style={{ padding: 24, color: "#94a3b8", marginBottom: 16 }}>Loading business snapshot…</div>;
  }

  const { bookings, revenue, week, topTurfs, visitors, community } = data;
  const weekRevenue = week.reduce((s, d) => s + d.revenue, 0);
  const weekBookings = week.reduce((s, d) => s + d.bookings, 0);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12, marginBottom: 14 }}>
        <Tile icon={IconTicket} tone="#2563eb" label="Today's games" value={bookings.today} hint={`${bookings.upcoming} upcoming · ${bookings.pending} pending`} onClick={() => onNavigate("bookings")} />
        <Tile icon={IconAward} tone="#059669" label="Revenue (active bookings)" value={money(revenue.total)} hint={`${money(revenue.discountsGiven)} given as discounts`} onClick={() => onNavigate("bookings")} />
        <Tile icon={IconUsers} tone="#7c3aed" label="Players registered" value={visitors.total} hint={`+${visitors.thisWeek} this week`} onClick={() => onNavigate("visitors")} />
        <Tile icon={IconBell} tone="#d97706" label="Zone requests to review" value={community.openEnquiries} hint={`${community.openPlayerRequests} open games · ${community.messages24h} chats today`} onClick={() => onNavigate("enquiries")} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
            <strong>Sales — last 7 days</strong>
            <span style={{ fontSize: 12, color: "#64748b" }}>{money(weekRevenue)} · {weekBookings} bookings</span>
          </div>
          <WeekBars week={week} />
        </div>

        <div className="card" style={{ padding: 16 }}>
          <strong>Top turfs by revenue</strong>
          {topTurfs.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 10 }}>Bookings will rank your turfs here.</p>
          ) : (
            <ol style={{ margin: "10px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
              {topTurfs.map((t, i) => (
                <li key={t.turfId || i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14 }}>
                  <span>
                    <span style={{ color: "#94a3b8", fontWeight: 700, marginRight: 8 }}>{i + 1}</span>
                    {t.name}
                  </span>
                  <span style={{ whiteSpace: "nowrap" }}>
                    <strong>{money(t.revenue)}</strong> <span style={{ color: "#94a3b8", fontSize: 12 }}>· {t.bookings}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
