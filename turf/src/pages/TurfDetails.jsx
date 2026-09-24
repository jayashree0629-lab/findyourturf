import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Heart,
  Share2,
  MapPin,
  Clock,
  Star,
  ShieldCheck,
  Zap,
  CalendarDays,
  ExternalLink,
  Warehouse,
  Sun,
  CloudRain,
  Wind,
  Thermometer,
  Dumbbell,
  CheckCircle2,
  Phone,
  Info,
} from "lucide-react";
import { getTurf, getBookedSlots, getTurfWeather } from "../services/api";
import { generateSlots } from "../services/slots";
import { getTurfImage } from "../utils/sportsImages";
import { socket } from "../services/socket";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import BookMyShowSlotPicker from "../components/BookMyShowSlotPicker";
import { DetailsSkeleton } from "../components/SkeletonLoader";

function buildDateChips(count = 7) {
  const chips = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(today.getDate() + i);
    chips.push({
      day: i === 0 ? "TODAY" : i === 1 ? "TOMORROW" : d.toLocaleDateString("en-IN", { weekday: "short" }).toUpperCase(),
      num: d.getDate().toString().padStart(2, "0"),
      month: d.toLocaleDateString("en-IN", { month: "short" }),
      fullDate: d.toISOString().split("T")[0],
    });
  }
  return chips;
}

const ROOF_LABEL = {
  Open: { text: "Open Roof", icon: <Sun size={12} /> },
  Closed: { text: "Closed / Roofed", icon: <Warehouse size={12} /> },
  Partial: { text: "Partial Roof", icon: <Warehouse size={12} /> },
  "Not verified": { text: "Roof: Not verified", icon: <Info size={12} /> },
};

export default function TurfDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [turf, setTurf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const dateChips = useMemo(() => buildDateChips(7), []);
  const [selectedDate, setSelectedDate] = useState(dateChips[0].fullDate);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const data = await getTurf(id);
        setTurf(data);
      } catch (err) {
        console.error("Failed to load turf details:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  // Slot availability for the chosen day (+ live refresh on new bookings).
  useEffect(() => {
    let active = true;
    if (!id || !selectedDate) return undefined;

    function refreshSlots() {
      setSlotsLoading(true);
      getBookedSlots(id, selectedDate)
        .then((slots) => active && setBookedSlots(slots || []))
        .catch(() => active && setBookedSlots([]))
        .finally(() => active && setSlotsLoading(false));
    }

    setSelectedSlot(null);
    refreshSlots();

    const onBookingChange = (payload) => {
      if (String(payload?.turf) === String(id)) refreshSlots();
    };
    socket.on("booking:created", onBookingChange);
    socket.on("booking:cancelled", onBookingChange);

    return () => {
      active = false;
      socket.off("booking:created", onBookingChange);
      socket.off("booking:cancelled", onBookingChange);
    };
  }, [id, selectedDate]);

  // Weather forecast for the chosen day.
  useEffect(() => {
    let active = true;
    if (!id || !selectedDate) return undefined;
    setWeatherLoading(true);
    getTurfWeather(id, selectedDate)
      .then((w) => active && setWeather(w))
      .catch(() => active && setWeather({ available: false }))
      .finally(() => active && setWeatherLoading(false));
    return () => {
      active = false;
    };
  }, [id, selectedDate]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: turf?.name || "Find Your Turf",
          text: `Check out ${turf?.name} on Find Your Turf!`,
          url: window.location.href,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="fyt-app-shell">
        <Navbar />
        <main className="fyt-main-content">
          <DetailsSkeleton />
        </main>
      </div>
    );
  }

  if (!turf) {
    return (
      <div className="fyt-app-shell">
        <Navbar />
        <main className="fyt-main-content">
          <div className="fyt-container" style={{ padding: "60px 16px", textAlign: "center" }}>
            <h2>Turf Not Found</h2>
            <p style={{ color: "var(--text-secondary)", margin: "12px 0 24px" }}>
              The sports turf you are looking for does not exist or has been removed.
            </p>
            <button className="fyt-btn-primary" onClick={() => navigate("/turfs")}>
              Back to Turfs
            </button>
          </div>
        </main>
      </div>
    );
  }

  const duration = turf.slotDurationMinutes || 60;
  const slots = generateSlots(turf, { date: selectedDate, bookedSlots });
  const chosenSlotObj = slots.find((s) => s.value === selectedSlot);
  const hours = Math.max(1, duration / 60);
  const availCount = slots.filter((s) => s.available).length;

  const galleryImages = [getTurfImage(turf, 0), getTurfImage(turf, 1), getTurfImage(turf, 2)];
  const facilities = turf.facilities && turf.facilities.length ? turf.facilities : [];
  const equipment = turf.equipment || [];
  const roof = ROOF_LABEL[turf.roofType] || ROOF_LABEL["Not verified"];
  const sportList = Array.isArray(turf.sports) && turf.sports.length ? turf.sports : turf.sportType ? [turf.sportType] : [];
  const hasPrice = turf.pricePerHour != null && turf.pricePerHour > 0;
  const hoursKnown = Boolean(turf.openingTime || turf.closingTime);
  const isBookable = hasPrice && availCount > 0;

  const handleBooking = () => {
    if (!selectedSlot) return;
    navigate(`/turfs/${id}/checkout`, {
      state: {
        turf,
        date: selectedDate,
        slot: selectedSlot,
        endSlot: chosenSlotObj?.endLabel,
        startMinutes: chosenSlotObj?.startMinutes,
        durationMinutes: duration,
      },
    });
  };

  return (
    <div className="fyt-app-shell fyt-has-sticky-cta">
      <Navbar />

      <main className="fyt-main-content" style={{ paddingBottom: 110 }}>
        <div className="fyt-container">
          <div className="fyt-td-nav-bar">
            <button className="fyt-back-btn" onClick={() => navigate(-1)} aria-label="Go Back">
              <ArrowLeft size={18} />
              <span>Back</span>
            </button>
            <div className="fyt-td-top-actions">
              <button
                className={`fyt-action-circle ${isLiked ? "liked" : ""}`}
                onClick={() => setIsLiked(!isLiked)}
                aria-label="Favorite"
              >
                <Heart size={18} fill={isLiked ? "#EF4444" : "none"} color={isLiked ? "#EF4444" : "#0F172A"} />
              </button>
              <button className="fyt-action-circle" onClick={handleShare} aria-label="Share">
                <Share2 size={18} />
                {copied && <span className="fyt-copied-tooltip">Link copied!</span>}
              </button>
            </div>
          </div>

          <div className="fyt-td-layout-grid">
            {/* LEFT */}
            <div className="fyt-td-left-col">
              <div className="fyt-td-gallery">
                <div className="fyt-td-main-image-wrap">
                  <img src={galleryImages[activeImageIndex]} alt={turf.name} className="fyt-td-main-img" />
                  <div className="fyt-td-img-overlay">
                    <span className="fyt-td-sport-pill">
                      {sportList.length ? sportList.join(" · ") : "Turf"}
                    </span>
                    <span className="fyt-td-verified-pill">
                      <MapPin size={13} /> {turf.location}
                    </span>
                  </div>
                </div>
                <div className="fyt-td-thumbnails">
                  {galleryImages.map((img, idx) => (
                    <button
                      key={idx}
                      className={`fyt-td-thumb ${activeImageIndex === idx ? "active" : ""}`}
                      onClick={() => setActiveImageIndex(idx)}
                    >
                      <img src={img} alt={`View ${idx + 1}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="fyt-td-header-card">
                <div className="fyt-td-title-row">
                  <div>
                    <h1 className="fyt-td-title">{turf.name}</h1>
                    <div className="fyt-td-loc-row">
                      <MapPin size={16} className="fyt-loc-pin" />
                      <span>{turf.address || `${turf.location}, Coimbatore`}</span>
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(
                          turf.name + " " + (turf.address || turf.location)
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="fyt-map-link"
                      >
                        <span>View on Maps</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                  {turf.rating != null && (
                    <div className="fyt-td-rating-box">
                      <div className="fyt-td-rating-val">
                        <Star size={16} fill="#FBBF24" color="#FBBF24" />
                        <span>{turf.rating}</span>
                      </div>
                      <span className="fyt-td-rating-count">{turf.reviewsCount || 0} reviews</span>
                    </div>
                  )}
                </div>

                <div className="fyt-td-tags-list">
                  {sportList.map((s) => (
                    <span key={s} className="fyt-badge-tag">{s}</span>
                  ))}
                  <span className="fyt-badge-tag">{roof.icon} {roof.text}</span>
                  {hasPrice ? (
                    <span className="fyt-badge-tag">
                      {isBookable ? "🟢 Slots available today" : "🔴 No slots left today"}
                    </span>
                  ) : (
                    <span className="fyt-badge-tag">📞 Booking via venue</span>
                  )}
                  {turf.floodlightChargePerHour > 0 && (
                    <span className="fyt-badge-tag">
                      <Zap size={12} /> Floodlights +₹{turf.floodlightChargePerHour}/hr
                    </span>
                  )}
                  {turf.contactNumber && (
                    <span className="fyt-badge-tag"><Phone size={12} /> {turf.contactNumber}</span>
                  )}
                </div>
              </div>

              {/* Weather */}
              <section className="fyt-td-section-card">
                <h2 className="fyt-section-title">
                  Weather ·{" "}
                  {new Date(selectedDate).toLocaleDateString("en-IN", {
                    weekday: "long",
                    day: "numeric",
                    month: "short",
                  })}
                </h2>
                {(weather?.weatherLocation || turf.weatherLocation) && (
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginTop: -4, marginBottom: 10 }}>
                    Forecast for {weather?.weatherLocation || turf.weatherLocation}
                    {weather && weather.available && weather.coordsVerified === false ? " (area-level)" : ""}
                  </p>
                )}
                {weatherLoading ? (
                  <p style={{ color: "var(--text-secondary)" }}>Checking the forecast…</p>
                ) : weather && weather.available ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 40, lineHeight: 1 }}>{weather.icon}</div>
                      <div>
                        <strong style={{ fontSize: "1.05rem" }}>{weather.condition}</strong>
                        <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: 2 }}>
                          {weather.playable
                            ? "Good conditions for play"
                            : "Rain likely — a covered turf is a safer bet"}
                        </div>
                      </div>
                    </div>
                    <div className="fyt-info-grid-2" style={{ marginTop: 14 }}>
                      <div className="fyt-info-stat-box">
                        <span className="fyt-isb-label"><Thermometer size={13} /> Temperature</span>
                        <strong className="fyt-isb-val">
                          {Math.round(weather.tempMinC)}° – {Math.round(weather.tempMaxC)}°C
                        </strong>
                      </div>
                      <div className="fyt-info-stat-box">
                        <span className="fyt-isb-label"><CloudRain size={13} /> Chance of rain</span>
                        <strong className="fyt-isb-val">{weather.precipitationChance ?? 0}%</strong>
                      </div>
                      <div className="fyt-info-stat-box">
                        <span className="fyt-isb-label"><Wind size={13} /> Max wind</span>
                        <strong className="fyt-isb-val">{Math.round(weather.windMaxKmh ?? 0)} km/h</strong>
                      </div>
                      <div className="fyt-info-stat-box">
                        <span className="fyt-isb-label"><Warehouse size={13} /> Roof</span>
                        <strong className="fyt-isb-val">{roof.text}</strong>
                      </div>
                    </div>
                  </>
                ) : (
                  <p style={{ color: "var(--text-secondary)" }}>
                    Forecast unavailable right now — please check again later.
                  </p>
                )}
              </section>

              {/* Facilities */}
              <section className="fyt-td-section-card">
                <h2 className="fyt-section-title">Facilities</h2>
                {facilities.length ? (
                  <div className="fyt-amenities-grid">
                    {facilities.map((label, idx) => (
                      <div key={idx} className="fyt-amenity-item">
                        <div className="fyt-amenity-icon"><CheckCircle2 size={18} /></div>
                        <span className="fyt-amenity-label">{label}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: "var(--text-secondary)" }}>
                    Facility details are not verified for this turf yet.
                  </p>
                )}
              </section>

              {/* Equipment */}
              {equipment.length > 0 && (
                <section className="fyt-td-section-card">
                  <h2 className="fyt-section-title">Playing Equipment</h2>
                  <p
                    style={{
                      color: "var(--text-secondary)",
                      fontSize: "0.85rem",
                      marginTop: -4,
                      marginBottom: 12,
                    }}
                  >
                    Add any of these to your booking at checkout.
                  </p>
                  <div style={{ display: "grid", gap: 8 }}>
                    {equipment.map((eq, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 12px",
                          border: "1px solid var(--border-color, #e5e7eb)",
                          borderRadius: 10,
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Dumbbell size={15} className="fyt-loc-pin" /> {eq.name}
                        </span>
                        <strong style={{ color: eq.rentalCharge > 0 ? "var(--text-primary)" : "#16a34a" }}>
                          {eq.rentalCharge > 0 ? `₹${eq.rentalCharge}` : "Free"}
                        </strong>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Info */}
              <section className="fyt-td-section-card">
                <h2 className="fyt-section-title">Turf Info</h2>
                {turf.description && (
                  <p className="fyt-td-about-text">{turf.description}</p>
                )}
                <div style={{ display: "grid", gap: 8, marginTop: turf.description ? 12 : 0 }}>
                  <div className="fyt-td-hours-info">
                    <Clock size={16} className="fyt-clock-icon" />
                    <span>
                      {hoursKnown ? (
                        <>Open <strong>{turf.openingTime || "—"}</strong> – <strong>{turf.closingTime || "—"}</strong></>
                      ) : (
                        <>Opening hours: <strong>Not verified</strong></>
                      )}{" "}
                      · Slot length: <strong>{duration} mins</strong>
                    </span>
                  </div>
                  {turf.contactNumber && (
                    <div className="fyt-td-hours-info">
                      <Phone size={16} className="fyt-clock-icon" />
                      <span>Venue contact: <strong>{turf.contactNumber}</strong></span>
                    </div>
                  )}
                  <div className="fyt-td-hours-info">
                    <Dumbbell size={16} className="fyt-clock-icon" />
                    <span>
                      Equipment:{" "}
                      <strong>
                        {equipment.length ? equipment.map((e) => e.name).join(", ") : "Not verified"}
                      </strong>
                    </span>
                  </div>
                </div>
              </section>
            </div>

            {/* RIGHT: booking panel */}
            <div className="fyt-td-right-col">
              {!hasPrice ? (
                <div className="fyt-booking-panel">
                  <span className="fyt-bp-tag">Booking</span>
                  <h3 className="fyt-bp-title" style={{ marginBottom: 8 }}>Contact the venue to book</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>
                    Online pricing and slots for this turf are not verified yet. Call the venue directly to
                    check availability and rates.
                  </p>
                  {turf.contactNumber ? (
                    <a
                      href={`tel:${turf.contactNumber.replace(/\s+/g, "")}`}
                      className="fyt-btn-book-primary"
                      style={{ marginTop: 14, textDecoration: "none" }}
                    >
                      <Phone size={16} /> Call {turf.contactNumber}
                    </a>
                  ) : (
                    <p style={{ marginTop: 12, fontWeight: 700 }}>Contact number not available.</p>
                  )}
                  <div className="fyt-bp-guarantee">
                    <Info size={14} /> <span>We only show verified data — nothing is guessed.</span>
                  </div>
                </div>
              ) : (
              <div className="fyt-booking-panel">
                <div className="fyt-bp-header">
                  <div>
                    <span className="fyt-bp-tag">Step-by-Step Booking</span>
                    <h3 className="fyt-bp-title">Select Date &amp; Time Slot</h3>
                  </div>
                  <div className="fyt-bp-price">
                    <span className="fyt-bp-price-val">₹{turf.pricePerHour}</span>
                    <span className="fyt-bp-price-unit">/ hr</span>
                  </div>
                </div>

                <div className="fyt-bp-section">
                  <label className="fyt-bp-label">
                    <CalendarDays size={16} /> <span>1. Select Date</span>
                  </label>
                  <div className="fyt-chips-scroll" style={{ padding: "4px 0 10px" }}>
                    {dateChips.map((chip) => (
                      <button
                        key={chip.fullDate}
                        className={`fyt-date-chip ${selectedDate === chip.fullDate ? "active" : ""}`}
                        onClick={() => setSelectedDate(chip.fullDate)}
                      >
                        <span className="fyt-dc-day">{chip.day}</span>
                        <span className="fyt-dc-num">{chip.num}</span>
                        <span className="fyt-dc-month">{chip.month}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="fyt-bp-section">
                  <label className="fyt-bp-label" style={{ marginBottom: 12 }}>
                    <Clock size={16} /> <span>2. Select Time Slot</span>
                  </label>
                  <BookMyShowSlotPicker
                    slots={slots}
                    selectedSlot={selectedSlot}
                    onSelectSlot={(val) => setSelectedSlot(val)}
                    loading={slotsLoading}
                    date={selectedDate}
                    turf={turf}
                  />
                </div>

                <div
                  className="fyt-bp-section"
                  style={{ borderTop: "1px dashed var(--border-color, #e5e7eb)", paddingTop: 12 }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.9rem",
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ color: "var(--text-secondary)" }}>Base ({hours} hr)</span>
                    <strong>₹{Math.round(turf.pricePerHour * hours)}</strong>
                  </div>
                  {turf.floodlightChargePerHour > 0 && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.85rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      <span>
                        <Zap size={12} style={{ verticalAlign: "middle" }} /> Floodlights (optional)
                      </span>
                      <span>+₹{Math.round(turf.floodlightChargePerHour * hours)}</span>
                    </div>
                  )}
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 6 }}>
                    Choose players &amp; add-ons and see the full split on the next step.
                  </div>
                </div>

                <button
                  className="fyt-btn-book-primary"
                  onClick={handleBooking}
                  disabled={!selectedSlot}
                  style={{ marginTop: 12 }}
                >
                  {selectedSlot
                    ? `Continue · ₹${Math.round(turf.pricePerHour * hours)}`
                    : "Choose an Available Slot"}
                </button>

                <div className="fyt-bp-guarantee">
                  <ShieldCheck size={14} /> <span>Instant confirmation · Split the bill with your team</span>
                </div>
              </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <div className="fyt-sticky-mobile-bottom">
        {hasPrice ? (
          <>
            <div className="fyt-smb-info">
              <div className="fyt-smb-price">
                <strong>₹{turf.pricePerHour}</strong>
                <span>/ hr</span>
              </div>
              <span className="fyt-smb-slot-indicator">
                {selectedSlot ? `Selected: ${selectedSlot}` : "Pick a time slot"}
              </span>
            </div>
            <button className="fyt-smb-btn" onClick={handleBooking} disabled={!selectedSlot}>
              {selectedSlot ? "Continue" : "Select Slot"}
            </button>
          </>
        ) : (
          <>
            <div className="fyt-smb-info">
              <span className="fyt-smb-slot-indicator" style={{ fontWeight: 700 }}>
                {turf.name}
              </span>
              <span className="fyt-smb-slot-indicator">Booking via venue</span>
            </div>
            {turf.contactNumber ? (
              <a
                className="fyt-smb-btn"
                href={`tel:${turf.contactNumber.replace(/\s+/g, "")}`}
                style={{ textDecoration: "none" }}
              >
                <Phone size={14} style={{ verticalAlign: "middle" }} /> Call
              </a>
            ) : (
              <button className="fyt-smb-btn" disabled>No contact</button>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
