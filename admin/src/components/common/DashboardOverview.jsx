import {
  IconTicket,
  IconUsers,
  IconAward,
  IconBell,
  IconAlertCircle,
  IconMapPin,
  IconCheck,
  IconTrophy,
  IconLive,
} from "./Icons";
import { Pill, formatDate, money } from "./adminUi";

function Kpi({ icon: Icon, label, value, hint, tone, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className="dash-kpi" onClick={onClick} style={{ "--tone": tone }}>
      <span className="dash-kpi-ico"><Icon size={20} /></span>
      <span className="dash-kpi-body">
        <span className="dash-kpi-label">{label}</span>
        <span className="dash-kpi-value">{value}</span>
        {hint && <span className="dash-kpi-hint">{hint}</span>}
      </span>
    </Tag>
  );
}

function SalesBars({ week }) {
  const max = Math.max(1, ...week.map((d) => d.revenue));
  return (
    <div className="dash-bars" role="img" aria-label="Sales for the last 7 days">
      {week.map((d) => {
        const h = d.revenue > 0 ? Math.max(8, Math.round((d.revenue / max) * 100)) : 3;
        const day = new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });
        return (
          <div key={d.date} className="dash-bar" title={`${d.date}: ${money(d.revenue)} from ${d.bookings} bookings`}>
            <span className="dash-bar-val">{d.revenue > 0 ? money(d.revenue) : ""}</span>
            <div className="dash-bar-fill" style={{ height: `${h}%`, opacity: d.revenue > 0 ? 1 : 0.35 }} />
            <span className="dash-bar-day">{day}</span>
          </div>
        );
      })}
    </div>
  );
}

function payTone(p) {
  if (!p || p.amountPending <= 0) return "green";
  return p.amountPaid > 0 ? "amber" : "red";
}

export default function DashboardOverview({ data, error, tournaments, onNavigate, adminName }) {
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  if (error) {
    return (
      <div className="alert-banner error" style={{ marginBottom: 16 }}>
        <span>The business summary couldn't be loaded: {error}</span>
      </div>
    );
  }
  if (!data) {
    return <div className="card" style={{ padding: 28, color: "#94a3b8" }}>Loading your dashboard…</div>;
  }

  const { bookings, revenue, week, topTurfs, visitors, community, pending, upcoming, owners } = data;
  const turfsMissingOwner = Math.max(0, (owners?.activeTurfs || 0) - (owners?.turfsWithOwner || 0));
  const weekSales = week.reduce((s, d) => s + d.revenue, 0);
  const weekCount = week.reduce((s, d) => s + d.bookings, 0);

  const attention = [
    pending.count > 0 && {
      key: "pending",
      tone: "amber",
      title: `${pending.count} booking${pending.count === 1 ? "" : "s"} with payment pending`,
      text: `${money(pending.amount)} still to be collected on upcoming games.`,
      cta: "Review pending",
      go: () => onNavigate("bookings", "Pending"),
    },
    owners.alertsPending > 0 && {
      key: "alerts",
      tone: "blue",
      title: `${owners.alertsPending} owner alert${owners.alertsPending === 1 ? "" : "s"} waiting to be sent`,
      text: "Turf owners haven't been told about these bookings yet.",
      cta: "Send alerts",
      go: () => onNavigate("owner-alerts"),
    },
    community.openEnquiries > 0 && {
      key: "zones",
      tone: "violet",
      title: `${community.openEnquiries} student / corporate request${community.openEnquiries === 1 ? "" : "s"} to review`,
      text: "Players are waiting for approval.",
      cta: "Review requests",
      go: () => onNavigate("enquiries"),
    },
    turfsMissingOwner > 0 && {
      key: "owners",
      tone: "red",
      title: `${turfsMissingOwner} turf${turfsMissingOwner === 1 ? " has" : "s have"} no owner contact`,
      text: "Add the owner's name and phone so they get booking alerts.",
      cta: "Add owner details",
      go: () => onNavigate("turfs"),
    },
  ].filter(Boolean);

  return (
    <div className="dash">
      <div className="dash-welcome">
        <div>
          <h2>{greet}{adminName ? `, ${adminName.split(" ")[0]}` : ""}</h2>
          <p>{today} · here's how your turfs are doing.</p>
        </div>
      </div>

      <div className="dash-kpis">
        <Kpi icon={IconTicket} tone="#2563eb" label="Today's games" value={bookings.today} hint={`${bookings.upcoming} upcoming in total`} onClick={() => onNavigate("bookings", "Today")} />
        <Kpi icon={IconAlertCircle} tone="#d97706" label="Payments pending" value={money(pending.amount)} hint={pending.count ? `${pending.count} booking${pending.count === 1 ? "" : "s"} to collect` : "Nothing pending"} onClick={() => onNavigate("bookings", "Pending")} />
        <Kpi icon={IconAward} tone="#059669" label="Revenue" value={money(revenue.total)} hint={`${money(revenue.discountsGiven)} given as discounts`} onClick={() => onNavigate("bookings", "All")} />
        <Kpi icon={IconUsers} tone="#7c3aed" label="Players" value={visitors.total} hint={`+${visitors.thisWeek} this week`} onClick={() => onNavigate("visitors")} />
      </div>

      <div className="dash-grid">
        <section className="card dash-card">
          <div className="dash-card-head">
            <h3>Needs your attention</h3>
          </div>
          {attention.length === 0 ? (
            <div className="dash-allgood">
              <span><IconCheck size={22} /></span>
              <div>
                <strong>You're all caught up</strong>
                <p>No pending payments, alerts or requests right now.</p>
              </div>
            </div>
          ) : (
            <ul className="dash-attention">
              {attention.map((a) => (
                <li key={a.key} className={`tone-${a.tone}`}>
                  <span className="dot" />
                  <div>
                    <strong>{a.title}</strong>
                    <p>{a.text}</p>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={a.go}>{a.cta}</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card dash-card">
          <div className="dash-card-head">
            <h3>Sales — last 7 days</h3>
            <span>{money(weekSales)} · {weekCount} booking{weekCount === 1 ? "" : "s"}</span>
          </div>
          <SalesBars week={week} />
        </section>
      </div>

      <section className="card dash-card" style={{ marginTop: 16 }}>
        <div className="dash-card-head">
          <h3>Upcoming games</h3>
          <button className="btn btn-outline btn-sm" onClick={() => onNavigate("bookings", "Upcoming")}>All bookings</button>
        </div>
        {upcoming.length === 0 ? (
          <p className="dash-empty">No upcoming games yet. New bookings will show up here.</p>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr><th>When</th><th>Turf</th><th>Player</th><th>Amount</th><th>Payment</th></tr>
              </thead>
              <tbody>
                {upcoming.map((b) => (
                  <tr key={b._id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{formatDate(b.bookingDate, { utc: true })}</div>
                      <div className="muted">{b.startTime}</div>
                    </td>
                    <td>{b.turfName}</td>
                    <td>
                      <div>{b.contactName}</div>
                      <div className="muted">{b.contactPhone}</div>
                    </td>
                    <td style={{ fontWeight: 700 }}>{money(b.totalAmount)}</td>
                    <td>
                      {b.payment.amountPending > 0 ? (
                        <Pill tone={payTone(b.payment)}>{money(b.payment.amountPending)} pending</Pill>
                      ) : (
                        <Pill tone="green">Paid</Pill>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="dash-grid" style={{ marginTop: 16 }}>
        <section className="card dash-card">
          <div className="dash-card-head"><h3>Top turfs by revenue</h3></div>
          {topTurfs.length === 0 ? (
            <p className="dash-empty">Bookings will rank your turfs here.</p>
          ) : (
            <ol className="dash-rank">
              {topTurfs.map((t, i) => (
                <li key={t.turfId || i}>
                  <span className="n">{i + 1}</span>
                  <span className="name">{t.name}</span>
                  <span className="val"><strong>{money(t.revenue)}</strong><em>{t.bookings} booking{t.bookings === 1 ? "" : "s"}</em></span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="card dash-card">
          <div className="dash-card-head"><h3>Tournaments</h3>
            <button className="btn btn-outline btn-sm" onClick={() => onNavigate("events")}>Manage events</button>
          </div>
          <div className="dash-mini">
            <div><IconTrophy size={18} /><strong>{tournaments.events}</strong><span>Events</span></div>
            <div><IconMapPin size={18} /><strong>{owners.activeTurfs}</strong><span>Active turfs</span></div>
            <div><IconLive size={18} /><strong>{tournaments.live}</strong><span>Live matches</span></div>
            <div><IconBell size={18} /><strong>{community.openPlayerRequests}</strong><span>Open games</span></div>
          </div>
        </section>
      </div>
    </div>
  );
}
