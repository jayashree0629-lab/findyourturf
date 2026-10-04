import { useState, useEffect, useCallback, useMemo } from "react";
import { socket } from "../services/socket";
import Modal from "../components/common/Modal";
import { IconTicket, IconRefresh, IconSearch, IconPhone } from "../components/common/Icons";
import { getBookings, cancelBooking, confirmBooking, markSplitMemberPaid, getTurfOwners } from "../services/api";
import {
  useFlash,
  FlashBanner,
  PageHeader,
  PageIntro,
  Pill,
  EmptyBox,
  ConfirmModal,
  formatDate,
  money,
} from "../components/common/adminUi";

const FILTERS = ["All", "Upcoming", "Today", "Pending", "Completed", "Cancelled"];

function dayKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function todayKey() {
  const local = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return local;
}

const ref = (b) => `FYT-${String(b._id).slice(-6).toUpperCase()}`;

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function payLabel(b) {
  const p = b.payment || {};
  if (b.status === "Cancelled") return { tone: "red", text: "Cancelled" };
  if (p.amountPending > 0) {
    if (p.mode === "split") return { tone: p.amountPaid > 0 ? "amber" : "red", text: `${money(p.amountPending)} pending` };
    if (p.mode === "venue") return { tone: "amber", text: `${money(p.amountPending)} at venue` };
    return { tone: "red", text: `${money(p.amountPending)} pending` };
  }
  return { tone: "green", text: "Paid" };
}

function waLink(phone, text) {
  const digits = String(phone || "").replace(/\D/g, "").slice(-10);
  return `https://wa.me/91${digits}?text=${encodeURIComponent(text)}`;
}

function DetailModal({ booking, owner, busy, onClose, onMarkPaid, onConfirm, onCancel }) {
  if (!booking) return null;
  const p = booking.payment || {};
  const cancelled = booking.status === "Cancelled";
  const when = `${formatDate(booking.bookingDate, { utc: true })}, ${booking.startTime}`;
  const pct = booking.totalAmount > 0 ? Math.min(100, Math.round((p.amountPaid / booking.totalAmount) * 100)) : 0;

  return (
    <Modal isOpen onClose={onClose} title={`Booking ${ref(booking)}`} maxWidth="640px">
      <div className="modal-body">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 16 }}>
          <div><div className="muted">Turf</div><strong>{booking.turf ? booking.turf.name : "Removed turf"}</strong></div>
          <div><div className="muted">When</div><strong>{when}</strong></div>
          <div>
            <div className="muted">Booked by</div>
            <strong>{booking.contactName}</strong>
            <div><a href={`tel:+91${booking.contactPhone}`} style={{ color: "#2563eb", fontSize: 13 }}>+91 {booking.contactPhone}</a></div>
          </div>
          <div><div className="muted">Group</div><strong>{booking.players} players</strong></div>
        </div>

        <div style={{ padding: 14, borderRadius: 12, background: "#f8fafc", border: "1px solid #eef0f4" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
            <strong>Payment</strong>
            <Pill tone={payLabel(booking).tone}>{payLabel(booking).text}</Pill>
          </div>
          {!cancelled && (
            <>
              <div style={{ height: 8, borderRadius: 999, background: "#e2e8f0", margin: "12px 0", overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: p.amountPending > 0 ? "#f59e0b" : "#10b981" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, textAlign: "center" }}>
                <div><div className="muted">Total</div><strong>{money(booking.totalAmount)}</strong></div>
                <div><div className="muted">Paid</div><strong style={{ color: "#059669" }}>{money(p.amountPaid)}</strong></div>
                <div><div className="muted">Pending</div><strong style={{ color: p.amountPending > 0 ? "#d97706" : "#059669" }}>{money(p.amountPending)}</strong></div>
              </div>
              <div className="muted" style={{ marginTop: 10 }}>
                Method: {booking.paymentMethod}
                {booking.couponCode ? ` · Coupon ${booking.couponCode} (−${money(booking.discountAmount)})` : ""}
                {booking.addonsAmount > 0 ? ` · Add-ons ${money(booking.addonsAmount)}` : ""}
              </div>
            </>
          )}
        </div>

        {booking.paymentPlan === "split" && !cancelled && (
          <div style={{ marginTop: 16 }}>
            <strong>Split payment</strong>
            <div className="muted" style={{ margin: "2px 0 8px" }}>
              Each player pays {money(p.share)}. {booking.players - 1 - p.membersPaid > 0
                ? `${booking.players - 1 - p.membersPaid} teammate${booking.players - 1 - p.membersPaid === 1 ? " is" : "s are"} yet to pay.`
                : "Everyone has paid."}
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead><tr><th>Player</th><th>Share</th><th>Status</th><th style={{ textAlign: "right" }}>Action</th></tr></thead>
                <tbody>
                  <tr>
                    <td><strong>{booking.contactName}</strong><div className="muted">Organiser</div></td>
                    <td>{money(p.share)}</td>
                    <td><Pill tone="green">Paid</Pill></td>
                    <td />
                  </tr>
                  {(booking.splitMembers || []).map((m) => (
                    <tr key={m.phone}>
                      <td><strong>{m.name || "Teammate"}</strong><div className="muted">+91 {m.phone}</div></td>
                      <td>{money(p.share)}</td>
                      <td>
                        {m.paid ? <Pill tone="green">Paid {m.paidAt ? formatDate(m.paidAt) : ""}</Pill> : <Pill tone="amber">Pending</Pill>}
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {!m.paid && (
                          <>
                            <a
                              className="btn btn-secondary btn-sm"
                              target="_blank"
                              rel="noopener noreferrer"
                              href={waLink(m.phone, `Hi ${m.name || ""}, your share of ${money(p.share)} for the turf booking at ${booking.turf ? booking.turf.name : "the turf"} on ${when} is still pending. Please pay it to confirm the slot. Ref ${ref(booking)}.`)}
                            >
                              Remind
                            </a>{" "}
                            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => onMarkPaid(booking, m)}>
                              Mark paid
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {owner && (
          <div className="muted" style={{ marginTop: 14 }}>
            Turf owner: <strong style={{ color: "#0f172a" }}>{owner.name}</strong> ·{" "}
            <a href={`tel:+91${owner.phone}`} style={{ color: "#2563eb" }}><IconPhone size={12} /> +91 {owner.phone}</a>
            {" "}— booking updates go to them through Owner alerts.
          </div>
        )}
        {!owner && !cancelled && (
          <div className="muted" style={{ marginTop: 14, color: "#b45309" }}>
            This turf has no owner contact yet, so no one is being alerted. Add it under Turfs &amp; owners.
          </div>
        )}
      </div>
      <div className="modal-footer">
        {booking.status === "Pending" && !cancelled && (
          <button className="btn btn-primary" disabled={busy} onClick={() => onConfirm(booking)}>Confirm anyway</button>
        )}
        {!cancelled && (
          <button className="btn btn-outline-danger" disabled={busy} onClick={() => onCancel(booking)}>Cancel booking</button>
        )}
        <button className="btn btn-secondary" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

export default function BookingsManagement({ initialFilter = "Upcoming" }) {
  const [bookings, setBookings] = useState([]);
  const [owners, setOwners] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(FILTERS.includes(initialFilter) ? initialFilter : "Upcoming");
  const [query, setQuery] = useState("");
  const [flash, setFlash] = useFlash();
  const [confirm, setConfirm] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, ownerList] = await Promise.all([getBookings(), getTurfOwners().catch(() => [])]);
      setBookings(list);
      setOwners(Object.fromEntries(ownerList.map((o) => [String(o.turfId), o])));
    } catch (err) {
      setFlash("error", err.message || "Couldn't load bookings.");
    } finally {
      setLoading(false);
    }
  }, [setFlash]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const events = ["booking:created", "booking:cancelled", "booking:split-payment"];
    events.forEach((e) => socket.on(e, load));
    return () => events.forEach((e) => socket.off(e, load));
  }, [load]);

  const today = todayKey();
  const hasPending = (b) => b.status !== "Cancelled" && b.payment && b.payment.amountPending > 0;

  const counts = useMemo(() => {
    const active = bookings.filter((b) => b.status !== "Cancelled");
    const pending = bookings.filter(hasPending);
    return {
      total: bookings.length,
      today: active.filter((b) => dayKey(b.bookingDate) === today).length,
      upcoming: active.filter((b) => dayKey(b.bookingDate) >= today).length,
      pendingCount: pending.length,
      pendingAmount: pending.reduce((s, b) => s + b.payment.amountPending, 0),
      revenue: active.reduce((s, b) => s + (b.payment ? b.payment.amountPaid : 0), 0),
    };
  }, [bookings, today]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookings
      .filter((b) => {
        const d = dayKey(b.bookingDate);
        if (filter === "Upcoming" && !(b.status !== "Cancelled" && d >= today)) return false;
        if (filter === "Today" && !(b.status !== "Cancelled" && d === today)) return false;
        if (filter === "Pending" && !hasPending(b)) return false;
        if (filter === "Completed" && !(b.status !== "Cancelled" && d < today)) return false;
        if (filter === "Cancelled" && b.status !== "Cancelled") return false;
        if (!q) return true;
        return [b.contactName, b.contactPhone, b.turf && b.turf.name, ref(b), b.couponCode]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      })
      .sort((a, b) =>
        ["Upcoming", "Today", "Pending"].includes(filter)
          ? new Date(a.bookingDate) - new Date(b.bookingDate)
          : new Date(b.bookingDate) - new Date(a.bookingDate)
      );
  }, [bookings, filter, query, today]);

  const pendingInView = rows.filter(hasPending);
  const pendingInViewAmount = pendingInView.reduce((s, b) => s + b.payment.amountPending, 0);
  const detail = bookings.find((b) => b._id === detailId) || null;

  const runAction = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.action === "cancel") {
        await cancelBooking(confirm.booking._id);
        setFlash("success", `Booking ${ref(confirm.booking)} cancelled and the slot is free again. The turf owner has been alerted.`);
        setDetailId(null);
      } else {
        await confirmBooking(confirm.booking._id);
        setFlash("success", `Booking ${ref(confirm.booking)} confirmed.`);
      }
      setConfirm(null);
      await load();
    } catch (err) {
      setFlash("error", err.message || "That action failed.");
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async (booking, member) => {
    setBusy(true);
    try {
      await markSplitMemberPaid(booking._id, member.phone);
      setFlash("success", `${member.name || member.phone} marked as paid. The turf owner has been told.`);
      await load();
    } catch (err) {
      setFlash("error", err.message || "Couldn't record that payment.");
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const header = ["Ref", "Player", "Phone", "Turf", "Date", "Time", "Players", "Total", "Paid", "Pending", "Coupon", "Status", "Method"];
    const lines = rows.map((b) =>
      [
        ref(b), b.contactName, b.contactPhone, b.turf && b.turf.name, formatDate(b.bookingDate, { utc: true }), b.startTime,
        b.players, b.totalAmount, b.payment ? b.payment.amountPaid : "", b.payment ? b.payment.amountPending : "",
        b.couponCode, b.status, b.paymentMethod,
      ].map(csvCell).join(",")
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookings-${filter.toLowerCase()}-${today}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div style={{ padding: 20 }}>
      <PageHeader title="Bookings" subtitle="Every turf booking made on the public site, with what has been paid and what is still pending.">
        <button className="btn btn-outline" onClick={exportCsv} disabled={rows.length === 0}>Export CSV</button>
        <button className="btn btn-outline" onClick={load} disabled={loading}><IconRefresh size={16} /> Refresh</button>
      </PageHeader>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 16 }}>
        {[
          ["Today's games", counts.today, "#0f172a"],
          ["Upcoming", counts.upcoming, "#0f172a"],
          ["Payments pending", `${money(counts.pendingAmount)}`, "#d97706", `${counts.pendingCount} booking${counts.pendingCount === 1 ? "" : "s"}`, "Pending"],
          ["Collected", money(counts.revenue), "#059669"],
        ].map(([label, value, color, hint, goto]) => (
          <button
            key={label}
            className="card"
            style={{ padding: "14px 16px", textAlign: "left", cursor: goto ? "pointer" : "default" }}
            onClick={() => goto && setFilter(goto)}
          >
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
            {hint && <div className="muted">{hint}</div>}
          </button>
        ))}
      </div>

      <FlashBanner flash={flash} onDismiss={() => setFlash(null)} />

      <div className="toolbar">
        <div className="filter-pills-group">
          {FILTERS.map((f) => (
            <button key={f} className={`filter-pill ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
              {f === "Pending" ? `Pending (${counts.pendingCount})` : f}
            </button>
          ))}
        </div>
        <div className="toolbar-search">
          <span><IconSearch size={15} /></span>
          <input className="form-control" placeholder="Search name, phone, turf or ref" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search bookings" />
        </div>
      </div>

      {filter === "Pending" && (
        <PageIntro icon={IconTicket} title={`${money(pendingInViewAmount)} is pending across ${pendingInView.length} booking${pendingInView.length === 1 ? "" : "s"}`}>
          A booking has a pending amount when a teammate hasn't paid their split share yet, or the player chose to pay at the venue. Click any row to see exactly who owes what.
        </PageIntro>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#666" }}>Loading bookings…</div>
        ) : rows.length === 0 ? (
          <EmptyBox icon={IconTicket} title="No bookings match" text="Try another filter or search term." />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr><th>Ref</th><th>Player</th><th>Turf</th><th>When</th><th>Group</th><th>Amount</th><th>Payment</th><th style={{ textAlign: "right" }}>Actions</th></tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const cancelled = b.status === "Cancelled";
                  const past = dayKey(b.bookingDate) < today;
                  const pay = payLabel(b);
                  return (
                    <tr key={b._id} onClick={() => setDetailId(b._id)} style={{ cursor: "pointer" }}>
                      <td style={{ fontWeight: 700, fontFamily: "monospace" }}>{ref(b)}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{b.contactName || "—"}</div>
                        <div className="muted">{b.contactPhone}</div>
                      </td>
                      <td>{b.turf ? b.turf.name : <span style={{ color: "#94a3b8" }}>Removed turf</span>}</td>
                      <td>
                        <div>{formatDate(b.bookingDate, { utc: true })}</div>
                        <div className="muted">{b.startTime}</div>
                      </td>
                      <td>
                        {b.players}
                        {b.paymentPlan === "split" && <div className="muted">Split · {b.payment.membersPaid + 1}/{b.players} paid</div>}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{money(b.totalAmount)}</div>
                        {b.couponCode && <div style={{ fontSize: 11, color: "#047857" }}>{b.couponCode} −{money(b.discountAmount)}</div>}
                      </td>
                      <td>
                        <Pill tone={pay.tone}>{pay.text}</Pill>
                        {!cancelled && past && <div className="muted">Completed</div>}
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setDetailId(b._id)}>Details</button>{" "}
                        {!cancelled && !past && (
                          <button className="btn btn-outline-danger btn-sm" onClick={() => setConfirm({ booking: b, action: "cancel" })}>Cancel</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DetailModal
        booking={detail}
        owner={detail && detail.turf ? owners[String(detail.turf._id)] : null}
        busy={busy}
        onClose={() => setDetailId(null)}
        onMarkPaid={markPaid}
        onConfirm={(b) => setConfirm({ booking: b, action: "confirm" })}
        onCancel={(b) => setConfirm({ booking: b, action: "cancel" })}
      />

      <ConfirmModal
        isOpen={Boolean(confirm)}
        danger={confirm?.action === "cancel"}
        busy={busy}
        title={confirm?.action === "cancel" ? "Cancel this booking?" : "Confirm this booking?"}
        message={
          confirm
            ? confirm.action === "cancel"
              ? `${ref(confirm.booking)} · ${confirm.booking.contactName} · ${formatDate(confirm.booking.bookingDate, { utc: true })} ${confirm.booking.startTime}. The slot opens up immediately, add-ons are released, any coupon goes back to the player, and the turf owner is alerted.`
              : `${ref(confirm.booking)} · ${confirm.booking.contactName} will be marked as confirmed even though some payment is still pending.`
            : ""
        }
        confirmLabel={confirm?.action === "cancel" ? "Cancel booking" : "Confirm booking"}
        onConfirm={runAction}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
