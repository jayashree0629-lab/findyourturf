import { useState, useEffect, useCallback, useRef } from "react";
import { socket } from "../services/socket";
import { IconBell, IconRefresh, IconPhone } from "../components/common/Icons";
import { getOwnerAlerts, markOwnerAlertSent, markAllOwnerAlertsSent } from "../services/api";
import {
  useFlash,
  FlashBanner,
  PageHeader,
  PageIntro,
  Pill,
  EmptyBox,
  formatDate,
} from "../components/common/adminUi";

const KIND = {
  NEW_BOOKING: { label: "New booking", tone: "blue" },
  BOOKING_CANCELLED: { label: "Cancelled", tone: "red" },
  SPLIT_PAYMENT: { label: "Split payment", tone: "amber" },
  PAYMENT_COMPLETE: { label: "Fully paid", tone: "green" },
};

export default function OwnerAlerts({ onCountChange }) {
  const [alerts, setAlerts] = useState([]);
  const [pending, setPending] = useState(0);
  const [status, setStatus] = useState("Pending");
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useFlash();

  // The parent passes a new function every render; keeping it in a ref stops
  // it from re-triggering the load (which would loop forever).
  const countRef = useRef(onCountChange);
  useEffect(() => {
    countRef.current = onCountChange;
  });

  const load = useCallback(async () => {
    try {
      const res = await getOwnerAlerts(status === "All" ? "" : status);
      setAlerts(res.notifications);
      setPending(res.pending);
      if (countRef.current) countRef.current(res.pending);
    } catch (err) {
      setFlash("error", err.message || "Couldn't load owner alerts.");
    } finally {
      setLoading(false);
    }
  }, [status, setFlash]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    // The server writes the alert just after the booking event fires.
    const refresh = () => setTimeout(load, 700);
    const events = ["booking:created", "booking:cancelled", "booking:split-payment"];
    events.forEach((e) => socket.on(e, refresh));
    return () => events.forEach((e) => socket.off(e, refresh));
  }, [load]);

  const send = async (alert) => {
    window.open(alert.whatsappUrl, "_blank", "noopener,noreferrer");
    try {
      await markOwnerAlertSent(alert._id);
      await load();
    } catch (err) {
      setFlash("error", err.message);
    }
  };

  const markSent = async (alert) => {
    try {
      await markOwnerAlertSent(alert._id);
      setFlash("success", "Marked as sent.");
      await load();
    } catch (err) {
      setFlash("error", err.message);
    }
  };

  const copy = async (alert) => {
    try {
      await navigator.clipboard.writeText(alert.message);
      setFlash("success", "Message copied.");
    } catch {
      setFlash("error", "Couldn't copy — select the text manually.");
    }
  };

  const markAll = async () => {
    try {
      const res = await markAllOwnerAlertsSent();
      setFlash("success", `${res.updated} alert${res.updated === 1 ? "" : "s"} marked as sent.`);
      await load();
    } catch (err) {
      setFlash("error", err.message);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <PageHeader title="Owner alerts" subtitle="Booking updates for each turf owner — new bookings, cancellations and split payments.">
        {pending > 0 && <button className="btn btn-outline" onClick={markAll}>Mark all as sent</button>}
        <button className="btn btn-outline" onClick={load} disabled={loading}><IconRefresh size={16} /> Refresh</button>
      </PageHeader>

      <PageIntro icon={IconBell} title="How owners find out about bookings">
        Every time a player books, cancels or a teammate pays their share, a ready-to-send message is created here for that turf's owner.
        Press <strong style={{ display: "inline" }}>Send on WhatsApp</strong> to open the message in WhatsApp and send it, or copy it. Owners can also open their own live booking page from <em>Turfs &amp; owners</em>.
      </PageIntro>

      <FlashBanner flash={flash} onDismiss={() => setFlash(null)} />

      <div className="filter-pills-group" style={{ marginBottom: 14 }}>
        {["Pending", "Sent", "All"].map((s) => (
          <button key={s} className={`filter-pill ${status === s ? "active" : ""}`} onClick={() => setStatus(s)}>
            {s === "Pending" ? `To send (${pending})` : s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "#666" }}>Loading alerts…</div>
      ) : alerts.length === 0 ? (
        <div className="card">
          <EmptyBox icon={IconBell} title={status === "Pending" ? "Nothing to send" : "No alerts here"} text="New booking updates will appear here automatically." />
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}>
          {alerts.map((a) => {
            const kind = KIND[a.kind] || { label: a.kind, tone: "slate" };
            return (
              <div key={a._id} className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{a.turfName || "Turf"}</div>
                    <div className="muted">{formatDate(a.createdAt, { time: true })}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <Pill tone={kind.tone}>{kind.label}</Pill>
                    <Pill tone={a.status === "Sent" ? "green" : "amber"}>{a.status === "Sent" ? "Sent" : "To send"}</Pill>
                  </div>
                </div>

                <pre style={{ margin: 0, padding: 12, background: "#f8fafc", border: "1px solid #eef0f4", borderRadius: 10, whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, lineHeight: 1.55, color: "#334155" }}>
                  {a.message}
                </pre>

                <div style={{ fontSize: 13 }}>
                  {a.hasOwner ? (
                    <>To <strong>{a.ownerName}</strong> · <a href={`tel:+91${a.ownerPhone}`} style={{ color: "#2563eb" }}><IconPhone size={12} /> +91 {a.ownerPhone}</a></>
                  ) : (
                    <span style={{ color: "#b45309" }}>No owner contact set for this turf — add it under Turfs &amp; owners.</span>
                  )}
                </div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: "auto" }}>
                  {a.hasOwner && a.status !== "Sent" && (
                    <button className="btn btn-primary btn-sm" onClick={() => send(a)}>Send on WhatsApp</button>
                  )}
                  <button className="btn btn-secondary btn-sm" onClick={() => copy(a)}>Copy</button>
                  {a.status !== "Sent" && (
                    <button className="btn btn-secondary btn-sm" onClick={() => markSent(a)}>Mark sent</button>
                  )}
                  {a.status === "Sent" && a.hasOwner && (
                    <button className="btn btn-secondary btn-sm" onClick={() => window.open(a.whatsappUrl, "_blank", "noopener,noreferrer")}>Send again</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
