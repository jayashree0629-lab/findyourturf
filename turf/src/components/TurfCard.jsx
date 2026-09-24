import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Star, Heart, Clock, ArrowRight, Sun, Warehouse, Zap, Phone } from "lucide-react";
import { getTurfImage } from "../utils/sportsImages";
import { generateSlots } from "../services/slots";

const SPORT_EMOJI = {
  football: "⚽",
  cricket: "🏏",
  "box cricket": "🏏",
  badminton: "🏸",
  basketball: "🏀",
  tennis: "🎾",
  pickleball: "🎾",
};

export default function TurfCard({ turf, index = 0, showSlots = true }) {
  const navigate = useNavigate();
  const [isLiked, setIsLiked] = useState(false);
  const [imageUrl, setImageUrl] = useState(() => getTurfImage(turf, index));

  const sportList = Array.isArray(turf.sports) && turf.sports.length
    ? turf.sports
    : turf.sportType
    ? [turf.sportType]
    : [];
  const sportLabel = sportList[0] || "Turf";
  const sportEmoji = SPORT_EMOJI[String(sportLabel).toLowerCase()] || "🏆";

  const hasPrice = turf.pricePerHour != null && turf.pricePerHour > 0;
  const hoursKnown = Boolean(turf.openingTime || turf.closingTime);
  const roofKnown = turf.roofType && turf.roofType !== "Not verified";

  const today = new Date().toISOString().split("T")[0];
  const slots = generateSlots(turf, { date: today }).filter((s) => !s.isPast);

  const goToDetails = () => navigate(`/turfs/${turf._id}`);

  return (
    <article
      className="fyt-turf-card"
      onClick={goToDetails}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToDetails();
        }
      }}
      aria-label={`${turf.name} — view details`}
    >
      <div className="fyt-tc-media">
        <img
          src={imageUrl}
          alt={turf.name}
          className="fyt-tc-img"
          loading="lazy"
          onError={() => setImageUrl("/cricket-turf.jpg")}
        />
        <div className="fyt-tc-gradient-scrim" />

        <div className="fyt-tc-top-badges">
          <span className="fyt-tc-sport-badge">
            <span>{sportEmoji}</span> {sportLabel}
          </span>
          <button
            className={`fyt-tc-heart-btn ${isLiked ? "liked" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsLiked(!isLiked);
            }}
            aria-label="Save to favorites"
          >
            <Heart size={16} fill={isLiked ? "#EF4444" : "none"} color={isLiked ? "#EF4444" : "#FFFFFF"} />
          </button>
        </div>

        {turf.rating != null && (
          <div className="fyt-tc-rating-badge">
            <Star size={13} className="fyt-star-icon" fill="#FBBF24" color="#FBBF24" />
            <span className="fyt-rating-score">{turf.rating}</span>
            {turf.reviewsCount > 0 && <span className="fyt-rating-count">({turf.reviewsCount})</span>}
          </div>
        )}
      </div>

      <div className="fyt-tc-content">
        <div className="fyt-tc-header">
          <h3 className="fyt-tc-title" title={turf.name}>{turf.name}</h3>
          <div className="fyt-tc-location">
            <MapPin size={14} className="fyt-loc-pin" />
            <span>{turf.location}</span>
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginTop: 6,
              fontSize: "0.72rem",
              color: "var(--text-secondary)",
            }}
          >
            {roofKnown && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                {turf.roofType === "Open" ? <Sun size={12} /> : <Warehouse size={12} />}
                {turf.roofType === "Open" ? "Open roof" : turf.roofType === "Partial" ? "Partial roof" : "Roofed"}
              </span>
            )}
            {turf.floodlightChargePerHour > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                <Zap size={12} /> Floodlights +₹{turf.floodlightChargePerHour}
              </span>
            )}
            {!hasPrice && turf.contactNumber && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                <Phone size={12} /> {turf.contactNumber}
              </span>
            )}
          </div>
        </div>

        {showSlots && (
          <div className="fyt-tc-slots-box">
            <div className="fyt-tc-slots-label">
              <Clock size={12} />
              <span>
                {hoursKnown
                  ? `Today · ${turf.openingTime || "—"}–${turf.closingTime || "—"}`
                  : "Hours not verified"}
              </span>
            </div>
            <div className="fyt-tc-slots-pills">
              {slots.length === 0 ? (
                <span className="fyt-slot-mini-pill closed">No slots left today</span>
              ) : (
                slots.slice(0, 3).map((slot) => (
                  <span key={slot.value} className={`fyt-slot-mini-pill ${slot.available ? "avail" : "taken"}`}>
                    {slot.label}
                  </span>
                ))
              )}
              {slots.length > 3 && <span className="fyt-slot-mini-pill more">+{slots.length - 3} more</span>}
            </div>
          </div>
        )}

        <div className="fyt-tc-footer">
          <div className="fyt-tc-pricing">
            <span className="fyt-price-unit">Price</span>
            <div className="fyt-price-val">
              {hasPrice ? (
                <>
                  <strong>₹{turf.pricePerHour}</strong>
                  <span className="fyt-price-suffix">/ hr</span>
                </>
              ) : (
                <strong style={{ fontSize: "0.85rem" }}>On request</strong>
              )}
            </div>
          </div>

          <button
            className="fyt-btn-book"
            onClick={(e) => {
              e.stopPropagation();
              goToDetails();
            }}
          >
            <span>{hasPrice ? "Book Now" : "View Details"}</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}
