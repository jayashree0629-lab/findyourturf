export default function Badge({
  status = "Upcoming",
  sport = null,
  className = "",
}) {
  if (sport) {
    const isCricket = (sport || "").toLowerCase() === "cricket";
    return (
      <span className={`badge ${isCricket ? "badge-sport-cricket" : "badge-sport-football"} ${className}`}>
        <span>{sport}</span>
      </span>
    );
  }

  const normalized = (status || "").toLowerCase();
  let badgeClass = "badge-upcoming";
  let showLivePulse = false;

  if (normalized === "live" || normalized === "ongoing") {
    badgeClass = "badge-live";
    showLivePulse = true;
  } else if (normalized === "completed" || normalized === "confirmed") {
    badgeClass = "badge-completed";
  } else if (normalized === "registration open" || normalized === "active") {
    badgeClass = "badge-registration-open";
  } else if (normalized === "cancelled" || normalized === "closed") {
    badgeClass = "badge-cancelled";
  }

  return (
    <span className={`badge ${badgeClass} ${className}`}>
      {showLivePulse && <span className="pulse-dot pulse-live" />}
      <span>{status}</span>
    </span>
  );
}
