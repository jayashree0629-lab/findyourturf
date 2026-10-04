import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { getOwnerPortal } from "../services/api";
import { socket } from "../services/socket";
import { Pill, formatDate, money } from "../components/common/adminUi";

const TABS = [
  { id: "upcoming", label: "Upcoming" },
  { id: "pending", label: "Payment pending" },
  { id: "past", label: "Past" },
  { id: "cancelled", label: "Cancelled" },
];

function payTone(b) {
  if (b.status === "Cancelled") return "red";
  if (b.payment.amountPending <= 0) return "green";
  return b.payment.amountPaid > 0 ? "amber" : "red";
}

function payText(b) {
  if (b.status === "Cancelled") return "Cancelled";
  if (b.payment.amountPending <= 0) return "Fully paid";
  if (b.payment.mode === "venue") return `${money(b.payment.amountPending)} to collect at venue`;
  return `${money(b.payment.amountPending)} pending`;
}

// Read-only page a turf owner opens from a private link — no admin login.
export default function OwnerPortal() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("upcoming");
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await getOwnerPortal(token));
      setError("");
    } catch (err) {
      setError(err.status === 404 ? "This link isn't valid any more. Please ask the FindYourTurf team for a new one." : err.message);
    }
  }, [token]);

  useEffect(() => {
    load();
    const refresh = () => setTimeout(load, 600);
    const events = ["booking:created", "booking:cancelled", "booking:split-payment"];
    events.forEach((e) => socket.on(e, refresh));
    return () => events.forEach((e) => socket.off(e, refresh));
  }, [load]);

  const groups = useMemo(() => {
    const b = data ? data.bookings : [];
    const active = b.filter((x) => x.status !== "Cancelled");
    return {
      upcoming: active.filter((x) => !x.isPast).sort((a, c) => new Date(a.startsAt) - new Date(c.startsAt)),
      pending: active.filter((x) => !x.isPast && x.payment.amountPending > 0).sort((a, c) => new Date(a.startsAt) - new Date(c.startsAt)),
      past: active.filter((x) => x.isPast),
      cancelled: b.filter((x) => x.status === "Cancelled"),
    };
  }, [data]);

  if (error) {
    return (
      <div className="owner-wrap">
        <div className="card" style={{ maxWidth: 480, margin: "80px auto", padding: 32, textAlign: "center" }}>
          <h2 style={{ margin: "0 0 8px" }}>We couldn't open this page</h2>
          <p style={{ color: "#64748b", margin: 0 }}>{error}</p>
        </div>
      </div>
    );
  }
  if (!data) return <div className="owner-wrap"><p style={{ textAlign: "center", padding: 80, color: "#94a3b8" }}>Loading your bookings…</p></div>;

  const rows = groups[tab];

  return (
    <div className="owner-wrap">
      <header className="owner-head">
        <div>
          <span className="owner-eyebrow">FindYourTurf · Owner view</span>
          <h1>{data.turf.name}</h1>
          <p>Hello {data.owner.name} — here are the bookings for {data.turf.location}. This page updates by itself.</p>
        </div>
      </header>

      <div className="dash-kpis" style={{ marginTop: 20 }}>
        <div className="dash-kpi"><span className="dash-kpi-body"><span className="dash-kpi-label">Upcoming games</span><span className="dash-kpi-value">{data.stats.upcoming}</span></span></div>
        <div className="dash-kpi"><span className="dash-kpi-body"><span className="dash-kpi-label">Payments pending</span><span className="dash-kpi-value" style={{ color: "#d97706" }}>{money(data.stats.pendingAmount)}</span><span className="dash-kpi-hint">{data.stats.pendingPayments} booking{data.stats.pendingPayments === 1 ? "" : "s"}</span></span></div>
        <div className="dash-kpi"><span className="dash-kpi-body"><span className="dash-kpi-label">Collected so far</span><span className="dash-kpi-value" style={{ color: "#059669" }}>{money(data.stats.collected)}</span></span></div>
        <div className="dash-kpi"><span className="dash-kpi-body"><span className="dash-kpi-label">All bookings</span><span className="dash-kpi-value">{data.stats.totalBookings}</span></span></div>
      </div>

      <div className="filter-pills-group" style={{ margin: "20px 0 12px" }}>
        {TABS.map((t) => (
          <button key={t.id} className={`filter-pill ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label} ({groups[t.id].length})
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {rows.length === 0 ? (
          <p style={{ padding: 40, textAlign: "center", color: "#94a3b8", margin: 0 }}>No bookings here.</p>
        ) : (
          rows.map((b) => (
            <div key={b._id} className="owner-row">
              <button className="owner-row-main" onClick={() => setOpen(open === b._id ? null : b._id)} aria-expanded={open === b._id}>
                <div className="when">
                  <strong>{formatDate(b.bookingDate, { utc: true })}</strong>
                  <span>{b.startTime}{b.endTime && b.endTime !== b.startTime ? ` – ${b.endTime}` : ""}</span>
                </div>
                <div className="who">
                  <strong>{b.playerName}</strong>
                  <span>{b.players} players · {b.ref}</span>
                </div>
                <div className="amt">
                  <strong>{money(b.totalAmount)}</strong>
                  <Pill tone={payTone(b)}>{payText(b)}</Pill>
                </div>
              </button>

              {open === b._id && (
                <div className="owner-row-more">
                  <div>Player: <strong>{b.playerName}</strong> · <a href={`tel:+91${b.playerPhone}`}>+91 {b.playerPhone}</a></div>
                  <div>Payment: {b.paymentMethod}{b.paymentPlan === "split" ? " · split between players" : ""}
                    {b.couponCode ? ` · coupon ${b.couponCode} (−${money(b.discountAmount)})` : ""}</div>
                  {b.addons.length > 0 && <div>Add-ons: {b.addons.join(", ")}</div>}
                  <div>Paid {money(b.payment.amountPaid)} of {money(b.totalAmount)}</div>
                  {b.paymentPlan === "split" && (
                    <div style={{ marginTop: 8 }}>
                      <strong>Split payment — {money(b.payment.share)} each</strong>
                      <ul>
                        <li>{b.playerName} (organiser) — <Pill tone="green">Paid</Pill></li>
                        {b.splitMembers.map((m) => (
                          <li key={m.phone}>
                            {m.name || "Teammate"} · <a href={`tel:+91${m.phone}`}>+91 {m.phone}</a> —{" "}
                            {m.paid ? <Pill tone="green">Paid</Pill> : <Pill tone="amber">Pending</Pill>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {data.notifications.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h3 style={{ margin: "0 0 10px" }}>Recent updates</h3>
          <div className="card" style={{ padding: "6px 16px" }}>
            {data.notifications.slice(0, 8).map((n) => (
              <div key={n._id} style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ fontSize: 14 }}>{n.title}</strong>
                  <span className="muted">{formatDate(n.createdAt, { time: true })}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="muted" style={{ textAlign: "center", margin: "28px 0" }}>
        This page is private to {data.turf.name}. Please don't share the link. Questions? Contact the FindYourTurf team.
      </p>
    </div>
  );
}
