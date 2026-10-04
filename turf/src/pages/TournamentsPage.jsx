import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Trophy,
  CalendarDays,
  MapPin,
  Users,
  ArrowRight,
  Flame,
  ShieldCheck,
} from "lucide-react";
import { getEvents } from "../services/api";
import { socket } from "../services/socket";
import { getEventImage } from "../utils/sportsImages";
import { isRegistrationOpen, registrationClosedLabel } from "../utils/registration";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import { EventCardSkeleton } from "../components/SkeletonLoader";
import EmptyState from "../components/EmptyState";

const REGISTRATION_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLScxnTEoxYDsNd24k4q-mniTvw3c9gpMUzwbNRoiTaqebZk4ig/viewform";

function formatDate(date) {
  if (!date) return "Date TBA";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "Date TBA";
  return value.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function TournamentsPage() {
  const navigate = useNavigate();
  const [realEvents, setRealEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState("ALL");
  const [searchQuery] = useState("");
  const [heroSlide, setHeroSlide] = useState(0);

  async function loadEvents() {
    try {
      setLoading(true);
      const data = await getEvents();
      setRealEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load tournaments from API:", err);
      setRealEvents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();

    const handleNewEvent = (event) => {
      setRealEvents((curr) => [event, ...curr.filter((e) => e._id !== event._id)]);
    };
    const handleUpdatedEvent = (event) => {
      setRealEvents((curr) => curr.map((e) => (e._id === event._id ? event : e)));
    };
    const handleDeletedEvent = ({ id }) => {
      setRealEvents((curr) => curr.filter((e) => e._id !== id));
    };

    socket.on("new-event", handleNewEvent);
    socket.on("event-updated", handleUpdatedEvent);
    socket.on("event-deleted", handleDeletedEvent);
    socket.on("tournament-updated", loadEvents);
    socket.on("live-score-updated", loadEvents);

    return () => {
      socket.off("new-event", handleNewEvent);
      socket.off("event-updated", handleUpdatedEvent);
      socket.off("event-deleted", handleDeletedEvent);
      socket.off("tournament-updated", loadEvents);
      socket.off("live-score-updated", loadEvents);
    };
  }, []);

  const allTournaments = realEvents;
  const featuredTournament = allTournaments.find((tournament) => {
    const name = (tournament.eventName || "").toLowerCase();
    return name.includes("one day") && name.includes("champion");
  }) || allTournaments[0];
  const heroSlides = featuredTournament
    ? [0, 1, 2].map((index) => getEventImage(featuredTournament, index))
    : [];

  useEffect(() => {
    if (heroSlides.length < 2) return undefined;
    const timer = setInterval(() => {
      setHeroSlide((current) => (current + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  // Sport chips: the usual ones plus any sport an admin has created an event for.
  const sportChips = [
    "ALL",
    ...new Set(["Cricket", "Football", "Badminton", ...allTournaments.map((t) => t.sport).filter(Boolean)]),
  ];

  // Filter tournaments
  const filteredTournaments = allTournaments.filter((t) => {
    const matchesSport =
      selectedSport === "ALL" || (t.sport || "").toLowerCase() === selectedSport.toLowerCase();
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      (t.eventName || "").toLowerCase().includes(q) ||
      (t.location || "").toLowerCase().includes(q) ||
      (t.sport || "").toLowerCase().includes(q);
    return matchesSport && matchesQuery;
  });

  return (
    <div className="fyt-app-shell">
      <Navbar />

      <main className="fyt-main-content fyt-tournaments-page" style={{ paddingBottom: 110 }}>
        {/* Top Header */}
        <div className="fyt-page-banner">
          <div className="fyt-container">
            <div className="fyt-td-nav-bar" style={{ padding: 0, marginBottom: 12 }}>
              <button className="fyt-back-btn" onClick={() => navigate(-1)} aria-label="Go Back">
                <ArrowLeft size={18} />
                <span>Back</span>
              </button>
              <div className="fyt-pb-badge" style={{ margin: 0, background: "#ECFDF5", borderColor: "#A7F3D0", color: "#047857" }}>
                <Trophy size={12} /> <span>{featuredTournament?.status || "AVAILABLE NOW"}</span>
              </div>
            </div>

            <div className="fyt-pb-content">
              <h1 className="fyt-pb-title">Tournaments</h1>
              <p className="fyt-pb-desc">
                Compete. Play. Win. Explore tournaments and register your squad today.
              </p>
            </div>

            {/* Feature Status Notice Bar */}
            <div className="fyt-tourney-notice-banner fyt-tourney-notice-active">
              <div className="fyt-tnb-icon">
                <ShieldCheck size={16} />
              </div>
              <div className="fyt-tnb-text">
                <strong>{featuredTournament?.status || "TOURNAMENTS ARE LIVE"}</strong>
                <span>Choose a tournament to view details and register your team.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Admin-published one-day championship promotion */}
        {featuredTournament && (
          <section className="fyt-section" style={{ paddingTop: 16, paddingBottom: 16 }}>
            <div className="fyt-container">
            <div className="fyt-tournament-hero-banner fyt-champion-hero-banner">
              <img
                src={heroSlides[heroSlide]}
                alt={featuredTournament.eventName}
                className="fyt-thb-bg"
                onError={(e) => {
                  e.currentTarget.src = "/cricket-turf.jpg";
                }}
              />
              <div className="fyt-thb-scrim" />
              <div className="fyt-thb-content">
                <div className="fyt-thb-tag">
                  <Flame size={14} /> <span>ONE DAY • ONE CHAMPION</span>
                </div>
                <h2 className="fyt-thb-headline">{featuredTournament.eventName}</h2>
                <p className="fyt-thb-subtitle">
                  {featuredTournament.description}
                </p>
                <div className="fyt-thb-stats-row">
                  <div className="fyt-thb-stat">
                    <strong>₹{featuredTournament?.firstPrize || 0}</strong>
                    <span>Champion Prize</span>
                  </div>
                  <div className="fyt-thb-stat-divider" />
                  <div className="fyt-thb-stat">
                    <strong>{featuredTournament ? formatDate(featuredTournament.eventDate) : "Date TBA"}</strong>
                    <span>Match Day</span>
                  </div>
                  <div className="fyt-thb-stat-divider" />
                  <div className="fyt-thb-stat">
                    <strong>{featuredTournament?.maxTeams || 0}</strong>
                    <span>Teams</span>
                  </div>
                </div>
                <div className="fyt-thb-dots" aria-label="Tournament images">
                  {heroSlides.map((_, index) => (
                    <button
                      key={index}
                      className={index === heroSlide ? "active" : ""}
                      onClick={() => setHeroSlide(index)}
                      aria-label={`View tournament image ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            </div>
          </section>
        )}

        {/* Sport Filters Row */}
        <section className="fyt-filters-section">
          <div className="fyt-container">
            <div className="fyt-chips-scroll">
              {sportChips.map((sport) => (
                <button
                  key={sport}
                  className={`fyt-sport-chip ${selectedSport === sport ? "active" : ""}`}
                  onClick={() => setSelectedSport(sport)}
                >
                  <span>
                    {sport === "Cricket" ? "🏏" : sport === "Football" ? "⚽" : sport === "Badminton" ? "🏸" : "🏆"}
                  </span>
                  <span>{sport === "ALL" ? "All Sports" : sport}</span>
                </button>
              ))}
            </div>

            <div className="fyt-subfilter-bar">
              <div className="fyt-results-counter">
                Showing <strong>{filteredTournaments.length}</strong> admin tournaments
              </div>
            </div>
          </div>
        </section>

        {/* Tournament Cards Grid */}
        <section className="fyt-turfs-grid-section">
          <div className="fyt-container">
            {loading ? (
              <div className="fyt-grid-3">
                {[1, 2, 3].map((n) => (
                  <EventCardSkeleton key={n} />
                ))}
              </div>
            ) : filteredTournaments.length === 0 ? (
              <EmptyState
                type="events"
                title="No tournaments found"
                message="Try selecting another sport filter or check back soon for upcoming tournament announcements."
                actionLabel="View All Tournaments"
                onAction={() => setSelectedSport("ALL")}
              />
            ) : (
              <div className="fyt-grid-3">
                {filteredTournaments.map((event, idx) => {
                  const displayImg = getEventImage(event, idx);

                  return (
                    <article
                      key={event._id || idx}
                      className="fyt-tournament-showcase-card"
                      onClick={() => navigate(`/tournaments/${event._id}`)}
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(`/tournaments/${event._id}`);
                        }
                      }}
                    >
                      {/* Media Image */}
                      <div className="fyt-tsc-media">
                        <img
                          src={displayImg}
                          alt={event.eventName}
                          className="fyt-tsc-img"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.src = "/cricket-turf.jpg";
                          }}
                        />
                        <div className="fyt-tsc-scrim" />

                        <div className="fyt-tsc-top-badges">
                          <span className="fyt-tsc-sport-badge">
                            {event.sport === "Football" ? "⚽ Football" : event.sport === "Badminton" ? "🏸 Badminton" : "🏏 Cricket"}
                          </span>

                          <span className="fyt-tsc-locked-status-badge fyt-tsc-active-status">
                            <ShieldCheck size={11} /> <span>{event.status || "AVAILABLE"}</span>
                          </span>
                        </div>

                        {event.firstPrize > 0 && (
                          <div className="fyt-tsc-prize-pill">
                            <Trophy size={13} />
                            <span>1st Prize: ₹{event.firstPrize}</span>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="fyt-tsc-content">
                        <div className="fyt-tsc-date-row">
                          <CalendarDays size={13} />
                          <span>{formatDate(event.eventDate)}</span>
                        </div>

                        <h3 className="fyt-tsc-title" title={event.eventName}>
                          {event.eventName}
                        </h3>

                        <div className="fyt-tsc-meta-row">
                          <div className="fyt-tsc-meta-item">
                            <MapPin size={13} />
                            <span>{event.location || "Coimbatore"}</span>
                          </div>
                          <div className="fyt-tsc-meta-item">
                            <Users size={13} />
                            <span>{event.maxTeams || 16} Teams</span>
                          </div>
                        </div>

                        <div className="fyt-tsc-footer">
                          <div className="fyt-tsc-fee">
                            <span className="fyt-tsc-fee-label">Entry Fee</span>
                            <strong className="fyt-tsc-fee-val">
                              {event.entryFee ? `₹${event.entryFee}` : "Free Entry"}
                            </strong>
                          </div>

                          <button
                            className="fyt-btn-view-tourney"
                            disabled={!isRegistrationOpen(event.status)}
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(REGISTRATION_FORM_URL, "_blank", "noopener,noreferrer");
                            }}
                          >
                            <span>{isRegistrationOpen(event.status) ? "Register" : registrationClosedLabel(event.status)}</span>
                            {isRegistrationOpen(event.status) && <ArrowRight size={14} />}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
