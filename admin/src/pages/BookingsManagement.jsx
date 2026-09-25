import { useState, useEffect, useCallback, useMemo } from "react";
import { socket } from "../services/socket";
import { IconTicket, IconRefresh, IconSearch } from "../components/common/Icons";
import { getBookings, cancelBooking, confirmBooking } from "../services/api";
import {
  useFlash,
  FlashBanner,
  PageHeader,
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
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
}

function ref(b) {
  return `FYT-${String(b._id).slice(-6).toUpperCase()}`;
}

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function BookingsManagement() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("Upcoming");
  const [query, setQuery] = useState("");
  const [flash, setFlash] = useFlash();
  const [confirm, setConfirm] = useState(null); // { booking, action }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setBookings(await getBookings());
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
    socket.on("booking:created", load);
    socket.on("booking:cancelled", load);
    return () => {
      socket.off("booking:created", load);
      socket.off("booking:cancelled", load);
    };
  }, [load]);

  const today = todayKey();

  const counts = useMemo(() => {
    const active = bookings.filter((b) => b.status !== "Cancelled");
    return {
      total: bookings.length,
      today: active.filter((b) => dayKey(b.bookingDate) === today).length,
      upcoming: active.filter((b) => dayKey(b.bookingDate) >= today).length,
      revenue: active.reduce((s, b) => s + (b.totalAmount || 0), 0),
    };
  }, [bookings, today]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookings
      .filter((b) => {
        const d = dayKey(b.bookingDate);
        if (filter === "Upcoming" && !(b.status !== "Cancelled" && d >= today)) return false;
        if (filter === "Today" && !(b.status !== "Cancelled" && d === today)) return false;
        if (filter === "Pending" && b.status !== "Pending") return false;
        if (filter === "Completed" && !(b.status !== "Cancelled" && d < today)) return false;
        if (filter === "Cancelled" && b.status !== "Cancelled") return false;
        if (!q) return true;
        return [b.contactName, b.contactPhone, b.turf && b.turf.name, ref(b), b.couponCode]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      })
      .sort((a, b) =>
        filter === "Upcoming" || filter === "Today"
          ? new Date(a.bookingDate) - new Date(b.bookingDate)
          : new Date(b.bookingDate) - new Date(a.bookingDate)
      );
  }, [bookings, filter, query, today]);

  const runAction = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.action === "cancel") {
        await cancelBooking(confirm.booking._id);
        setFlash("success", `Booking ${ref(confirm.booking)} cancelled and the slot is free again.`);
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

  const exportCsv = () => {
    const header = ["Ref", "Player", "Phone", "Turf", "Date", "Time", "Players", "Coupon", "Discount", "Total", "Status", "Payment"];
    const lines = rows.map((b) =>
      [
        ref(b),
        b.contactName,
        b.contactPhone,
        b.turf && b.turf.name,
        formatDate(b.bookingDate, { utc: true }),
        b.startTime,
        b.players,
        b.couponCode,
        b.discountAmount || 0,
        b.totalAmount,
        b.status,
        b.paymentMethod,
      ]
        .map(csvCell)
        .join(",")
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
      <PageHeader title="Bookings" subtitle="Every turf booking made on the public site. Confirm pending requests or cancel a slot to free it up.">
        <button className="btn btn-outline" onClick={exportCsv} disabled={rows.length === 0}>
          Export CSV
        </button>
        <button className="btn btn-outline" onClick={load} disabled={loading}>
          <IconRefresh size={16} /> Refresh
        </button>
      </PageHeader>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 16 }}>
        {[
          ["Today's games", counts.today],
          ["Upcoming", counts.upcoming],
          ["All bookings", counts.total],
          ["Revenue (active)", money(counts.revenue)],
        ].map(([label, value]) => (
          <div key={label} className="card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{value}</div>
          </div>
        ))}
      </div>

      <FlashBanner flash={flash} onDismiss={() => setFlash(null)} />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <div className="filter-pills-group">
          {FILTERS.map((f) => (
            <button key={f} className={`filter-pill ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
        <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 360 }}>
          <span style={{ position: "absolute", left: 12, top: 11, color: "#94a3b8", display: "inline-flex" }}>
            <IconSearch size={15} />
          </span>
          <input
            className="form-control"
            style={{ paddingLeft: 34 }}
            placeholder="Search name, phone, turf, ref or coupon"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search bookings"
          />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#666" }}>Loading bookings…</div>
        ) : rows.length === 0 ? (
          <EmptyBox icon={IconTicket} title="No bookings match" text="Try another filter or search term." />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Player</th>
                  <th>Turf</th>
                  <th>When</th>
                  <th>Group</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const cancelled = b.status === "Cancelled";
                  const past = dayKey(b.bookingDate) < today;
                  return (
                    <tr key={b._id}>
                      <td style={{ fontWeight: 700, fontFamily: "monospace" }}>{ref(b)}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{b.contactName || "—"}</div>
                        <div style={{ color: "#64748b", fontSize: 12 }}>{b.contactPhone}</div>
                      </td>
                      <td>{b.turf ? b.turf.name : <span style={{ color: "#94a3b8" }}>Removed turf</span>}</td>
                      <td>
                        <div>{formatDate(b.bookingDate, { utc: true })}</div>
                        <div style={{ color: "#64748b", fontSize: 12 }}>{b.startTime}</div>
                      </td>
                      <td>
                        {b.players} · {money(b.perPersonAmount)}/ea
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{money(b.totalAmount)}</div>
                        {b.couponCode && (
                          <div style={{ fontSize: 11, color: "#047857" }}>
                            {b.couponCode} −{money(b.discountAmount)}
                          </div>
                        )}
                        {b.addonsAmount > 0 && <div style={{ fontSize: 11, color: "#64748b" }}>incl. add-ons {money(b.addonsAmount)}</div>}
                      </td>
                      <td>
                        <Pill tone={cancelled ? "red" : b.status === "Pending" ? "amber" : past ? "slate" : "green"}>
                          {cancelled ? "Cancelled" : b.status === "Pending" ? "Pending" : past ? "Completed" : "Confirmed"}
                        </Pill>
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {b.status === "Pending" && (
                          <button className="btn btn-primary btn-sm" onClick={() => setConfirm({ booking: b, action: "confirm" })}>
                            Confirm
                          </button>
                        )}{" "}
                        {!cancelled && !past && (
                          <button className="btn btn-outline-danger btn-sm" onClick={() => setConfirm({ booking: b, action: "cancel" })}>
                            Cancel
                          </button>
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

      <ConfirmModal
        isOpen={Boolean(confirm)}
        danger={confirm?.action === "cancel"}
        busy={busy}
        title={confirm?.action === "cancel" ? "Cancel this booking?" : "Confirm this booking?"}
        message={
          confirm
            ? confirm.action === "cancel"
              ? `${ref(confirm.booking)} · ${confirm.booking.contactName} · ${formatDate(confirm.booking.bookingDate, { utc: true })} ${confirm.booking.startTime}. The slot opens up immediately, add-ons are released and any coupon is returned to the player.`
              : `${ref(confirm.booking)} · ${confirm.booking.contactName} will be marked as confirmed.`
            : ""
        }
        confirmLabel={confirm?.action === "cancel" ? "Cancel booking" : "Confirm booking"}
        onConfirm={runAction}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
