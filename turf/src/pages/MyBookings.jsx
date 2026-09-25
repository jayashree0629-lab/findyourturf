import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  CalendarPlus,
  Navigation,
  RotateCw,
  XCircle,
  Share2,
  Tag,
  Ticket,
} from "lucide-react";
import PageShell, { SkeletonList } from "../components/PageShell";
import EmptyState from "../components/EmptyState";
import { useIdentity, useToast } from "../components/AppProviders";
import { getMyBookingsDetailed, cancelMyBooking } from "../services/api";
import { getTurfImage } from "../utils/sportsImages";

const TABS = [
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
  { id: "cancelled", label: "Cancelled" },
];

function fmtDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function bookingRef(b) {
  return `FYT-${String(b._id).slice(-6).toUpperCase()}`;
}

// A calendar file so the game lands in the player's phone calendar.
function downloadIcs(b) {
  if (!b.startsAt) return;
  const start = new Date(b.startsAt);
  const end = new Date(start.getTime() + 60 * 60000);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Find Your Turf//EN",
    "BEGIN:VEVENT",
    `UID:${bookingRef(b)}@findyourturf`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:Turf booking - ${b.turf?.name || "Find Your Turf"}`,
    `LOCATION:${(b.turf?.address || b.turf?.location || "").replace(/,/g, "\\,")}`,
    `DESCRIPTION:Booking ${bookingRef(b)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${bookingRef(b)}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function shareBooking(b) {
  const text = `I've booked ${b.turf?.name || "a turf"} on ${fmtDate(b.bookingDate)} at ${b.startTime}. Join me! ⚽🏏`;
  if (navigator.share) {
    navigator.share({ title: "Turf booking", text }).catch(() => {});
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }
}

function CancelDialog({ booking, cancelWindowHours, busy, onConfirm, onClose }) {
  return (
    <div className="fyt-x-overlay" role="presentation" onClick={busy ? undefined : onClose}>
      <div className="fyt-x-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="fyt-x-modal-head">
          <h2>Cancel this booking?</h2>
        </div>
        <p className="fyt-x-sub" style={{ lineHeight: 1.6 }}>
          <strong>{booking.turf?.name}</strong> · {fmtDate(booking.bookingDate)} · {booking.startTime}
          <br />
          The slot will open up for other players straight away. Online cancellation is available until{" "}
          {cancelWindowHours} hours before the slot. Any refund is handled by the venue.
          {booking.couponCode && " Your coupon will be returned to you."}
        </p>
        <div className="fyt-x-modal-actions">
          <button className="fyt-btn-secondary" onClick={onClose} disabled={busy}>Keep booking</button>
          <button className="fyt-x-btn-danger" style={{ padding: "12px 16px" }} onClick={onConfirm} disabled={busy}>
            {busy ? "Cancelling…" : "Yes, cancel it"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BookingCard({ b, cancelWindowHours, onCancel }) {
  const navigate = useNavigate();
  const turf = b.turf || {};
  const cancelled = b.status === "Cancelled";
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    turf.address || `${turf.name || ""} ${turf.location || ""} Coimbatore`
  )}`;

  return (
    <article className="fyt-x-card fyt-x-booking">
      <div className="fyt-x-booking-top">
        <div className="fyt-x-row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
          <img className="fyt-x-booking-thumb" src={getTurfImage(turf, 0)} alt="" loading="lazy" />
          <div>
            <h3 className="fyt-x-card-title">{turf.name || "Turf"}</h3>
            <div className="fyt-x-meta" style={{ marginTop: 4 }}>
              <span><MapPin size={13} /> {turf.location || "Coimbatore"}</span>
              <span className="fyt-x-muted">Ref {bookingRef(b)}</span>
            </div>
          </div>
        </div>
        <span
          className={`fyt-x-badge ${
            cancelled ? "danger" : b.status === "Pending" ? "warn" : b.isPast ? "" : "success"
          }`}
        >
          {cancelled ? "Cancelled" : b.status === "Pending" ? "Pending" : b.isPast ? "Completed" : "Confirmed"}
        </span>
      </div>

      <div className="fyt-x-booking-when">
        <div className="fyt-x-when-item">
          <span><Calendar size={11} /> Date</span>
          <strong>{fmtDate(b.bookingDate)}</strong>
        </div>
        <div className="fyt-x-when-item">
          <span><Clock size={11} /> Time</span>
          <strong>{b.endTime && b.endTime !== b.startTime ? `${b.startTime} – ${b.endTime}` : b.startTime}</strong>
        </div>
        <div className="fyt-x-when-item">
          <span><Users size={11} /> Players</span>
          <strong>
            {b.players} · ₹{b.perPersonAmount}/each
          </strong>
        </div>
        <div className="fyt-x-when-item">
          <span>Total paid</span>
          <strong>₹{b.totalAmount}</strong>
        </div>
      </div>

      {(b.couponCode || (b.addons && b.addons.length > 0)) && (
        <div className="fyt-x-row">
          {b.couponCode && (
            <span className="fyt-x-badge info">
              <Tag size={11} /> {b.couponCode} · −₹{b.discountAmount}
            </span>
          )}
          {(b.addons || [])
            .filter((a) => a.status !== "Cancelled")
            .map((a) => (
              <span key={a._id} className="fyt-x-badge">
                {a.serviceName}
                {a.quantity > 1 ? ` ×${a.quantity}` : ""}
              </span>
            ))}
        </div>
      )}

      <div className="fyt-x-booking-actions">
        {!cancelled && !b.isPast && (
          <>
            <button className="fyt-btn-secondary fyt-x-btn-sm" onClick={() => downloadIcs(b)}>
              <CalendarPlus size={14} /> Add to calendar
            </button>
            <button className="fyt-btn-secondary fyt-x-btn-sm" onClick={() => window.open(mapsUrl, "_blank", "noopener,noreferrer")}>
              <Navigation size={14} /> Directions
            </button>
            <button className="fyt-btn-secondary fyt-x-btn-sm" onClick={() => shareBooking(b)}>
              <Share2 size={14} /> Invite friends
            </button>
            {b.canCancel ? (
              <button className="fyt-x-btn-danger" onClick={() => onCancel(b)}>
                <XCircle size={14} /> Cancel
              </button>
            ) : (
              <span className="fyt-x-muted" style={{ alignSelf: "center" }}>
                Within {cancelWindowHours}h of start — call the venue to change.
              </span>
            )}
          </>
        )}
        {(cancelled || b.isPast) && turf._id && (
          <button className="fyt-btn-primary fyt-x-btn-sm" onClick={() => navigate(`/turfs/${turf._id}`)}>
            <RotateCw size={14} /> Book again
          </button>
        )}
      </div>
    </article>
  );
}

export default function MyBookings() {
  const navigate = useNavigate();
  const toast = useToast();
  const { identity, requireIdentity } = useIdentity();
  const [tab, setTab] = useState("upcoming");
  const [data, setData] = useState({ bookings: [], cancelWindowHours: 2 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    if (!identity.ready) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setData(await getMyBookingsDetailed({ phone: identity.phone }));
    } catch (err) {
      setError(err.message || "Couldn't load your bookings.");
    } finally {
      setLoading(false);
    }
  }, [identity.ready, identity.phone]);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const upcoming = [];
    const past = [];
    const cancelled = [];
    data.bookings.forEach((b) => {
      if (b.status === "Cancelled") cancelled.push(b);
      else if (b.isPast) past.push(b);
      else upcoming.push(b);
    });
    // Soonest first for upcoming, most recent first for the rest.
    upcoming.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    return { upcoming, past, cancelled };
  }, [data.bookings]);

  const confirmCancel = async () => {
    setCancelling(true);
    try {
      const res = await cancelMyBooking(cancelTarget._id, identity.phone);
      toast.success(res.message || "Booking cancelled.");
      setCancelTarget(null);
      await load();
    } catch (err) {
      toast.error(err.message || "Couldn't cancel this booking.");
    } finally {
      setCancelling(false);
    }
  };

  const list = grouped[tab];

  return (
    <PageShell
      title="My Bookings"
      subtitle="Everything you've booked, in one place — manage, share or rebook in a tap."
      maxWidth={900}
      actions={
        <button className="fyt-btn-primary" onClick={() => navigate("/turfs")}>
          Book a turf
        </button>
      }
    >
      {!identity.ready ? (
        <EmptyState
          type="bookings"
          title="Tell us who you are"
          message="Add the mobile number you use for bookings and we'll show everything you've reserved."
          actionLabel="Add my number"
          onAction={async () => {
            if (await requireIdentity("Enter the mobile number you use when booking.")) load();
          }}
        />
      ) : (
        <>
          <div className="fyt-x-tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                className={`fyt-x-tab ${tab === t.id ? "active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label} ({grouped[t.id].length})
              </button>
            ))}
          </div>

          {error && (
            <div className="fyt-x-inline-msg error" style={{ marginBottom: 12 }}>
              {error}{" "}
              <button className="fyt-x-btn-ghost" onClick={load}>Retry</button>
            </div>
          )}

          {loading ? (
            <SkeletonList count={2} height={210} />
          ) : list.length === 0 ? (
            <EmptyState
              type="bookings"
              icon={<Ticket size={36} />}
              title={
                tab === "upcoming" ? "No upcoming bookings" : tab === "past" ? "No past bookings yet" : "Nothing cancelled"
              }
              message={
                tab === "upcoming"
                  ? "Pick a turf and a time slot — your booking will show up here instantly."
                  : "Your history will appear here after your first game."
              }
              actionLabel={tab === "upcoming" ? "Find a turf" : undefined}
              onAction={tab === "upcoming" ? () => navigate("/turfs") : undefined}
            />
          ) : (
            <div className="fyt-x-stack">
              {list.map((b) => (
                <BookingCard key={b._id} b={b} cancelWindowHours={data.cancelWindowHours} onCancel={setCancelTarget} />
              ))}
            </div>
          )}
        </>
      )}

      {cancelTarget && (
        <CancelDialog
          booking={cancelTarget}
          cancelWindowHours={data.cancelWindowHours}
          busy={cancelling}
          onConfirm={confirmCancel}
          onClose={() => setCancelTarget(null)}
        />
      )}
    </PageShell>
  );
}
