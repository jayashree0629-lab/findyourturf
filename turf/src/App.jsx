import { useEffect, useState } from "react";
import {
  Routes,
  Route,
  useNavigate,
  useParams
} from "react-router-dom";
import {
  Trophy,
  PlayCircle,
  ChevronRight,
  MapPin,
  Search,
  ArrowRight,
  Users,
  ArrowLeft,
  CalendarDays,
  Clock,
  Sparkles,
  ShieldCheck,
  ExternalLink,
  Flame,
  Lock,
} from "lucide-react";

import "./App.css";
import { getEvent, getEvents, getTournament } from "./services/api";
import { socket } from "./services/socket";
import { getEventImage } from "./utils/sportsImages";
import { isVisitorRegistered } from "./services/profile";

// Components
import Navbar from "./components/Navbar";
import BottomNav from "./components/BottomNav";
import SportCategoryCards from "./components/SportCategoryCards";
import { EventCardSkeleton } from "./components/SkeletonLoader";
import EmptyState from "./components/EmptyState";
import LockedFeatureModal from "./components/LockedFeatureModal";

// Pages
import UserLiveMatches from "./pages/UserLiveMatches";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";
import PublicMatchScorecard from "./pages/PublicMatchScorecard";
import TournamentsPage from "./pages/TournamentsPage";
import BookTurf from "./pages/BookTurf";
import TurfDetails from "./pages/TurfDetails";
import Checkout from "./pages/Checkout";
import AddonsCatalog from "./pages/AddonsCatalog";
import QuickRegister from "./pages/QuickRegister";

// Banners
import banner1 from "./assets/banners/promo_tournaments_1788516995082.jpg";

const REGISTRATION_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLScxnTEoxYDsNd24k4q-mniTvw3c9gpMUzwbNRoiTaqebZk4ig/viewform";

function useEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadEvents() {
    try {
      setLoading(true);
      setError("");
      const data = await getEvents();
      setEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to load tournaments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();

    const handleNewEvent = (event) => {
      setEvents((current) => {
        if (current.some((item) => item._id === event._id)) {
          return current;
        }
        return [event, ...current];
      });
    };

    const handleUpdatedEvent = (updatedEvent) => {
      setEvents((current) =>
        current.map((event) =>
          event._id === updatedEvent._id ? updatedEvent : event
        )
      );
    };

    const handleDeletedEvent = ({ id }) => {
      setEvents((current) => current.filter((event) => event._id !== id));
    };

    socket.on("new-event", handleNewEvent);
    socket.on("event-updated", handleUpdatedEvent);
    socket.on("event-deleted", handleDeletedEvent);

    return () => {
      socket.off("new-event", handleNewEvent);
      socket.off("event-updated", handleUpdatedEvent);
      socket.off("event-deleted", handleDeletedEvent);
    };
  }, []);

  return {
    events,
    loading,
    error,
    loadEvents,
  };
}

function HeroSection() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    navigate(q ? `/turfs?q=${encodeURIComponent(q)}` : "/turfs");
  };

  return (
    <section className="fyt-hero-section">
      <img className="fyt-mobile-hero-image" src={banner1} alt="" aria-hidden="true" />
      <div className="fyt-container">
        <div className="fyt-hero-grid">
          {/* Left Content */}
          <div className="fyt-hero-text">
            <p className="fyt-greeting">Good evening.</p>
            <div className="fyt-hero-pill">
              <Flame size={14} className="fyt-flame-icon" />
              <span>Coimbatore&apos;s #1 Sports Turf Network</span>
            </div>

            <h1 className="fyt-hero-heading">
              Where are we playing <span>tonight?</span>
            </h1>

            <p className="fyt-hero-subheading">
              Discover upcoming tournaments, follow live scores, and find your next favorite sport to play.
            </p>

            {/* Prominent Search Bar */}
            <form onSubmit={handleSearchSubmit} className="fyt-hero-search-form">
              <div className="fyt-hero-search-box">
                <div className="fyt-hero-loc-badge">
                  <MapPin size={16} />
                  <span>Coimbatore</span>
                </div>
                <div className="fyt-hero-search-input-wrap">
                  <Search size={18} className="fyt-search-icon" />
                  <input
                    type="text"
                    placeholder="Search turf, area (Peelamedu, RS Puram)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button type="submit" className="fyt-hero-search-btn">
                  <span>Find Turfs</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </form>

            {/* Quick Stats Badges */}
            <div className="fyt-hero-stats">
              <div className="fyt-stat-item">
                <strong>10+</strong>
                <span>Verified Turfs</span>
              </div>
              <div className="fyt-stat-divider" />
              <div className="fyt-stat-item">
                <strong>100%</strong>
                <span>Instant Slots</span>
              </div>
              <div className="fyt-stat-divider" />
              <div className="fyt-stat-item">
                <strong>4.8 ★</strong>
                <span>Player Rating</span>
              </div>
            </div>
          </div>

          {/* Right Visual Image Card */}
          <div className="fyt-hero-visual">
            <div className="fyt-hero-img-card">
              <img
                src="https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=900&auto=format&fit=crop"
                alt="Sports Turf"
                className="fyt-hero-main-img"
              />
              <div className="fyt-hero-img-gradient" />
              
              <div className="fyt-hero-floating-badge">
                <div className="fyt-hfb-icon">⚽</div>
                <div>
                  <strong>Live Booking Open</strong>
                  <span>Peelamedu &amp; Saravanampatti</span>
                </div>
              </div>

              <div className="fyt-hero-floating-badge top-right">
                <div className="fyt-hfb-icon">🏏</div>
                <div>
                  <strong>Box Cricket Ready</strong>
                  <span>Floodlights Enabled</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function QuickActions() {
  const navigate = useNavigate();
  const [lockedFeature, setLockedFeature] = useState("");
  const quickAccess = [
    { label: "Tournaments", Icon: Trophy, active: true, onClick: () => navigate("/tournaments") },
    { label: "Live Scores", Icon: PlayCircle, active: true, onClick: () => navigate("/live") },
    { label: "Book Turf", Icon: CalendarDays, active: true, onClick: () => navigate("/turfs") },
    { label: "Add-ons", Icon: Sparkles, active: true, onClick: () => navigate("/addons") },
    { label: "Find Players", Icon: Users },
    { label: "Auto Teams", Icon: Sparkles },
    { label: "Team Chat", Icon: PlayCircle },
    { label: "Student", Icon: Sparkles },
    { label: "Corporate", Icon: Users },
  ];

  return (
    <section className="fyt-qa-section">
      <div className="fyt-container">
        <div className="fyt-section-header-row fyt-quick-access-heading">
          <div>
            <h2 className="fyt-section-title">Quick access</h2>
            <p>Everything the app does, one tap away.</p>
          </div>
        </div>
        <div className="fyt-quick-access-grid" aria-label="Quick access">
          {quickAccess.map(({ label, Icon, active, onClick }) => (
            <button
              key={label}
              className={`fyt-quick-access-card ${active ? "is-active" : "is-locked"}`}
              onClick={onClick || (() => setLockedFeature(label))}
            >
              <span className="fyt-quick-access-icon"><Icon size={20} /></span>
              <span>{label}</span>
              {!active && <small><Lock size={10} /> Upcoming</small>}
            </button>
          ))}
        </div>
      </div>
      {lockedFeature && (
        <LockedFeatureModal feature={lockedFeature} onClose={() => setLockedFeature("")} />
      )}
    </section>
  );
}

function FeaturedTournamentAd() {
  const { events, loading } = useEvents();
  const [currentSlide, setCurrentSlide] = useState(0);
  const tournament = events.find((event) => {
    const name = (event.eventName || "").toLowerCase();
    return name.includes("one day") && name.includes("champion");
  }) || events[0];
  const slides = tournament
    ? [0, 1, 2].map((index) => ({
        image: getEventImage(tournament, index),
        eyebrow: `${tournament.sport || "SPORT"} • ONE DAY CHAMPIONSHIP`,
        headline: tournament.eventName,
        description: `${formatDate(tournament.eventDate)} • ${tournament.location || "Coimbatore"}`,
      }))
    : [];

  useEffect(() => {
    if (slides.length < 2) return undefined;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  if (loading || !tournament) return null;

  return (
    <section className="fyt-featured-tournament-ad">
      <div className="fyt-container">
        <div className="fyt-promo-slider fyt-featured-ad-slider">
          <img
            src={slides[currentSlide].image}
            alt={tournament.eventName}
            className="fyt-promo-bg"
          />
          <div className="fyt-promo-scrim" />
          <div className="fyt-promo-content">
            <span className="fyt-promo-eyebrow">{slides[currentSlide].eyebrow}</span>
            <h3 className="fyt-promo-headline">{slides[currentSlide].headline}</h3>
            <p className="fyt-promo-desc">{slides[currentSlide].description}</p>
          </div>
          <div className="fyt-promo-pagination">
            {slides.map((_, index) => (
              <button
                key={index}
                className={`fyt-promo-dot ${index === currentSlide ? "active" : ""}`}
                onClick={() => setCurrentSlide(index)}
                aria-label={`Slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function EventCard({ event, index = 0 }) {
  const navigate = useNavigate();
  const imageUrl = getEventImage(event, index);

  const displayTitle = event.eventName || "Cricket Turf Tournament";
  const displayLocation = event.location || "Coimbatore";
  const displayDate = event.eventDate ? formatDate(event.eventDate) : "12 Sept 2026";

  return (
    <article
      className="fyt-event-card"
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
      <div className="fyt-ec-img-box">
        <img src={imageUrl} alt={displayTitle} loading="lazy" />
        <div className="fyt-ec-gradient-scrim" />
        <div className="fyt-ec-top-badges">
          <span className="fyt-ec-sport-badge">
            {event.sport === "Football" ? "⚽ Football" : event.sport === "Badminton" ? "🏸 Badminton" : "🏏 Cricket"}
          </span>
          <span className="fyt-tsc-locked-status-badge fyt-tsc-active-status">
            <ShieldCheck size={11} /> <span>{event.status || "AVAILABLE"}</span>
          </span>
        </div>
        {event.firstPrize > 0 && (
          <span className="fyt-ec-prize-badge">
            <Trophy size={12} /> 1st ₹{event.firstPrize}
          </span>
        )}
      </div>

      <div className="fyt-ec-content">
        <div className="fyt-ec-date-row">
          <CalendarDays size={13} className="fyt-date-icon" />
          <span>{displayDate}</span>
        </div>

        <h3 className="fyt-ec-title" title={displayTitle}>
          {displayTitle}
        </h3>

        <div className="fyt-ec-meta-row">
          <div className="fyt-ec-meta-item">
            <MapPin size={13} /> <span>{displayLocation}</span>
          </div>
          <div className="fyt-ec-meta-item">
            <Users size={13} /> <span>{event.maxTeams || 16} Teams</span>
          </div>
        </div>

        <div className="fyt-ec-footer">
          <span className="fyt-ec-fee">
            {event.entryFee ? `Entry: ₹${event.entryFee}` : "Free Registration"}
          </span>
          <div className="fyt-ec-arrow-btn">
            <button
              type="button"
              className="fyt-inline-register-btn"
              onClick={(e) => {
                e.stopPropagation();
                window.open(REGISTRATION_FORM_URL, "_blank", "noopener,noreferrer");
              }}
            >
              Register
            </button>
            <ArrowRight size={14} />
          </div>
        </div>
      </div>
    </article>
  );
}

function LockedSections() {
  const [lockedFeature, setLockedFeature] = useState("");
  const sections = [
    { title: "My Bookings", detail: "Booking feature coming soon", icon: CalendarDays },
    { title: "Your Zone", detail: "Student & Corporate zones coming soon", icon: Users },
    { title: "Rewards", detail: "Earn rewards and unlock perks soon", icon: Trophy },
    { title: "Community", detail: "Connect with players soon", icon: Users },
  ];

  return (
    <section className="fyt-section fyt-locked-sections">
      <div className="fyt-container">
        <div className="fyt-section-header-row">
          <div>
            <span className="fyt-section-kicker">MORE FROM FIND YOUR TURF</span>
            <h2 className="fyt-section-title">Coming Soon</h2>
          </div>
        </div>
        <div className="fyt-locked-sections-grid">
          {sections.map(({ title, detail, icon: Icon }) => (
            <button
              key={title}
              className="fyt-locked-section-card"
              onClick={() => setLockedFeature(title)}
            >
              <span className="fyt-locked-section-icon"><Icon size={20} /></span>
              <span className="fyt-locked-section-copy">
                <strong>{title}</strong>
                <small><Lock size={11} /> Coming Soon</small>
                <em>{detail}</em>
              </span>
              <ChevronRight size={16} />
            </button>
          ))}
        </div>
      </div>
      {lockedFeature && (
        <LockedFeatureModal feature={lockedFeature} onClose={() => setLockedFeature("")} />
      )}
    </section>
  );
}

function UpcomingTournamentsSection() {
  const { events, loading } = useEvents();
  const navigate = useNavigate();
  const featuredEvents = events;

  return (
    <section className="fyt-section fyt-tournaments-home-section">
      <div className="fyt-container">
        <div className="fyt-section-header-row">
          <div>
            <span className="fyt-section-kicker">ADMIN-PUBLISHED EVENTS</span>
            <h2 className="fyt-section-title">Upcoming Tournaments</h2>
          </div>
          <button className="fyt-btn-view-all" onClick={() => navigate("/tournaments")}>
            <span>View All</span>
            <ChevronRight size={16} />
          </button>
        </div>

        {loading ? (
          <div className="fyt-grid-3">
            {[1, 2, 3].map((n) => (
              <EventCardSkeleton key={n} />
            ))}
          </div>
        ) : featuredEvents.length === 0 ? (
          <EmptyState
            type="events"
            title="No tournaments scheduled"
            message="The one-day champion tournament will appear here when it is published by admin."
          />
        ) : (
          <div className="fyt-grid-3">
            {featuredEvents.map((event, idx) => (
              <EventCard key={event._id || idx} event={event} index={idx} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Home() {
  return (
    <div className="fyt-app-shell">
      <Navbar />

      <main className="fyt-main-content" style={{ paddingBottom: 100 }}>
        {/* 1. Hero Discovery Area */}
        <HeroSection />

        {/* 2. Admin-published one-day championship promotion */}
        <FeaturedTournamentAd />

        {/* 3. Quick Action Cards */}
        <QuickActions />

        {/* 4. Admin-published one-day championship */}
        <UpcomingTournamentsSection />

        {/* 6. Sport Categories Explorer */}
        <section className="fyt-section">
          <div className="fyt-container">
            <div className="fyt-section-header-row">
              <div>
                <span className="fyt-section-kicker">DISCOVER BY SPORT</span>
                <h2 className="fyt-section-title">Explore Sport Categories</h2>
              </div>
            </div>
            <SportCategoryCards />
          </div>
        </section>

        {/* 6. Locked product areas */}
        <LockedSections />
      </main>

      <BottomNav />
    </div>
  );
}

function TournamentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("Overview");

  useEffect(() => {
    let mounted = true;

    async function loadPage() {
      try {
        setLoading(true);
        setError("");

        const [eventData, tournamentData] = await Promise.all([
          getEvent(id),
          getTournament(id).catch(() => null),
        ]);

        if (!mounted) return;
        setEvent(eventData);
        setTournament(tournamentData);
      } catch (err) {
        if (mounted) {
          setError(err.message || "Unable to load tournament details.");
          setEvent(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadPage();

    const handleEventUpdated = (updatedEvent) => {
      if (String(updatedEvent?._id) === String(id)) {
        setEvent(updatedEvent);
      }
    };

    const handleEventDeleted = (deletedId) => {
      if (String(deletedId) === String(id)) {
        setError("This tournament has been deleted.");
        setEvent(null);
      }
    };

    const handleTournamentUpdated = (updatedTournament) => {
      const tournamentPayload = updatedTournament?.tournament || updatedTournament;
      const tournamentEventId =
        tournamentPayload?.event?._id || tournamentPayload?.event;
      if (String(tournamentEventId) === String(id)) {
        setTournament(tournamentPayload);
      }
    };

    socket.on("event-updated", handleEventUpdated);
    socket.on("event-deleted", handleEventDeleted);
    socket.on("tournament-updated", handleTournamentUpdated);
    socket.on("live-score-updated", handleTournamentUpdated);

    return () => {
      mounted = false;
      socket.off("event-updated", handleEventUpdated);
      socket.off("event-deleted", handleEventDeleted);
      socket.off("tournament-updated", handleTournamentUpdated);
      socket.off("live-score-updated", handleTournamentUpdated);
    };
  }, [id]);

  if (loading) {
    return (
      <div className="fyt-app-shell">
        <Navbar />
        <main className="fyt-main-content">
          <div className="fyt-container" style={{ padding: "60px 16px", textAlign: "center" }}>
            <div className="fyt-loading-spinner" />
            <p style={{ marginTop: 14, color: "var(--text-secondary)" }}>Loading tournament information...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="fyt-app-shell">
        <Navbar />
        <main className="fyt-main-content">
          <div className="fyt-container" style={{ padding: "60px 16px", textAlign: "center" }}>
            <h2>Tournament Not Found</h2>
            <p style={{ color: "var(--text-secondary)", margin: "12px 0 24px" }}>
              {error || "This tournament is no longer active."}
            </p>
            <button className="fyt-btn-primary" onClick={() => navigate("/tournaments")}>
              Back to Tournaments
            </button>
          </div>
        </main>
      </div>
    );
  }

  const displayImage = getEventImage(event, 0);

  return (
    <div className="fyt-app-shell">
      <Navbar />

      <main className="fyt-main-content" style={{ paddingBottom: 110 }}>
        <div className="fyt-container" style={{ maxWidth: 900 }}>
          {/* Back Navigation */}
          <div className="fyt-td-nav-bar">
            <button className="fyt-back-btn" onClick={() => navigate(-1)} aria-label="Go Back">
              <ArrowLeft size={18} />
              <span>Back</span>
            </button>
            <div className="fyt-pb-badge" style={{ margin: 0, background: "#ECFDF5", borderColor: "#A7F3D0", color: "#047857" }}>
              <ShieldCheck size={12} /> <span>{event.status || "AVAILABLE NOW"}</span>
            </div>
          </div>

          {/* Tournament Hero Card */}
          <div className="fyt-tourney-hero-card">
            <img src={displayImage} alt={event.eventName} className="fyt-thc-img" />
            <div className="fyt-thc-scrim" />
            <div className="fyt-thc-body">
              <div className="fyt-thc-badge-row">
                <span className="fyt-thc-sport-badge">{event.sport || "Cricket"}</span>
                <span className="fyt-thc-status-badge fyt-tsc-active-status">
                  <ShieldCheck size={12} /> <span>{event.status || "REGISTRATION OPEN"}</span>
                </span>
              </div>
              <h1 className="fyt-thc-title">{event.eventName || "Tournament"}</h1>
              <div className="fyt-thc-meta-row">
                <span><MapPin size={14} /> {event.location || "Coimbatore"}</span>
                <span>•</span>
                <span><CalendarDays size={14} /> {event.eventDate ? formatDate(event.eventDate) : "Date TBA"}</span>
                <span>•</span>
                <span><Users size={14} /> {event.maxTeams || 16} Teams</span>
              </div>
            </div>
          </div>

          {/* Tabs Control */}
          <div className="fyt-card fyt-tourney-sheet-card" style={{ marginTop: 20 }}>
            <div className="fyt-tourney-tabs">
              {["Overview", "Rules", "Prizes", "Venue", "Contact"].map((tab) => (
                <button
                  key={tab}
                  className={`fyt-tourney-tab-btn ${activeTab === tab ? "active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="fyt-tourney-tab-content">
              {activeTab === "Overview" && (
                <>
                  <h3 className="fyt-card-heading">Key Information</h3>
                  <div className="fyt-info-grid-2" style={{ marginBottom: 24 }}>
                    <div className="fyt-info-stat-box">
                      <span className="fyt-isb-label"><Users size={14} /> Team Size</span>
                      <strong className="fyt-isb-val">{event.teamSize || "8 Players + 1 Impact"}</strong>
                    </div>

                    <div className="fyt-info-stat-box">
                      <span className="fyt-isb-label"><CalendarDays size={14} /> Tournament Date</span>
                      <strong className="fyt-isb-val">{event.eventDate ? formatDate(event.eventDate) : "TBA"}</strong>
                    </div>

                    <div className="fyt-info-stat-box">
                      <span className="fyt-isb-label"><Clock size={14} /> Registration Status</span>
                      <strong className="fyt-isb-val" style={{ color: "#D97706" }}>
                        {event.status || "Upcoming"}
                      </strong>
                    </div>

                    <div className="fyt-info-stat-box">
                      <span className="fyt-isb-label"><MapPin size={14} /> Location / Area</span>
                      <strong className="fyt-isb-val">{event.location || "Coimbatore"}</strong>
                    </div>
                  </div>

                  <h3 className="fyt-card-heading">Prize Pool</h3>
                  <div className="fyt-prize-cards-row">
                    <div className="fyt-prize-box gold">
                      <div className="fyt-pb-label"><Trophy size={16} /> 1st Prize</div>
                      <strong className="fyt-pb-amt">₹{event.firstPrize || 0}</strong>
                    </div>

                    <div className="fyt-prize-box silver">
                      <div className="fyt-pb-label"><Trophy size={16} /> 2nd Prize</div>
                      <strong className="fyt-pb-amt">₹{event.secondPrize || 0}</strong>
                    </div>

                    <div className="fyt-prize-box bronze">
                      <div className="fyt-pb-label"><Trophy size={16} /> 3rd Prize</div>
                      <strong className="fyt-pb-amt">₹{event.thirdPrize || 0}</strong>
                    </div>
                  </div>

                  <h3 className="fyt-card-heading" style={{ marginTop: 24 }}>About this Tournament</h3>
                  <p className="fyt-tourney-text">
                    {event.description || "Exciting tournament organized for sports players across Coimbatore."}
                  </p>

                  {event.keyHighlights && (
                    <>
                      <h3 className="fyt-card-heading" style={{ marginTop: 20 }}>Key Highlights</h3>
                      <p className="fyt-tourney-text">{event.keyHighlights}</p>
                    </>
                  )}

                  {tournament?.matches?.length > 0 && (
                    <>
                      <h3 className="fyt-card-heading" style={{ marginTop: 24 }}>
                        Live Tournament Scores
                      </h3>
                      <div className="fyt-tournament-score-list">
                        {tournament.matches.map((match) => (
                          <div className="fyt-tournament-score-row" key={match._id}>
                            <div>
                              <strong>{match.team1 || "Team A"}</strong>
                              <span>{match.team2 || "Team B"}</span>
                            </div>
                            <div className="fyt-tournament-score-values">
                              <strong>{match.team1Score ?? 0}/{match.team1Wickets ?? 0}</strong>
                              <span>vs</span>
                              <strong>{match.team2Score ?? 0}/{match.team2Wickets ?? 0}</strong>
                            </div>
                            <span className={`fyt-tournament-match-status ${String(match.status || "").toLowerCase()}`}>
                              {match.status || "Upcoming"}
                            </span>
                          </div>
                        ))}
                      </div>
                      {tournament.champion && (
                        <div className="fyt-tournament-champion">
                          <Trophy size={16} />
                          <span>Champion: <strong>{tournament.champion}</strong></span>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {activeTab === "Rules" && (
                <div>
                  <h3 className="fyt-card-heading">Rules &amp; Regulations</h3>
                  <p className="fyt-tourney-text">
                    {event.rules || "Standard tournament rules apply. Umpire / Referee decision is final."}
                  </p>
                </div>
              )}

              {activeTab === "Prizes" && (
                <div>
                  <h3 className="fyt-card-heading">
                    Total Prize Pool: ₹{(event.firstPrize || 0) + (event.secondPrize || 0) + (event.thirdPrize || 0)}
                  </h3>
                  <div className="fyt-prize-cards-row" style={{ marginTop: 16 }}>
                    <div className="fyt-prize-box gold">
                      <div className="fyt-pb-label">🥇 1st Place</div>
                      <strong className="fyt-pb-amt">₹{event.firstPrize || 0}</strong>
                    </div>
                    <div className="fyt-prize-box silver">
                      <div className="fyt-pb-label">🥈 2nd Place</div>
                      <strong className="fyt-pb-amt">₹{event.secondPrize || 0}</strong>
                    </div>
                    <div className="fyt-prize-box bronze">
                      <div className="fyt-pb-label">🥉 3rd Place</div>
                      <strong className="fyt-pb-amt">₹{event.thirdPrize || 0}</strong>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "Venue" && (
                <div>
                  <h3 className="fyt-card-heading">{event.venueName || "Tournament Venue"}</h3>
                  <p className="fyt-tourney-text">
                    <MapPin size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />
                    {event.location || "Coimbatore, Tamil Nadu"}
                  </p>
                </div>
              )}

              {activeTab === "Contact" && (
                <div>
                  <h3 className="fyt-card-heading">Organizer Contact Information</h3>
                  <p className="fyt-tourney-text">
                    For squad registration inquiries or sponsorship opportunities:<br />
                    <strong>{event.contactPhone || "+91 98765 43210"}</strong>
                  </p>
                </div>
              )}
            </div>

            {/* Registration Notice Banner */}
            <div className="fyt-tourney-notice-banner fyt-tourney-notice-active" style={{ marginTop: 24 }}>
              <div className="fyt-tnb-icon">
                <ShieldCheck size={16} />
              </div>
              <div className="fyt-tnb-text">
                <strong>{event.status || "REGISTRATION OPEN"}</strong>
                <span>Complete the official Google Form to register your team.</span>
              </div>
            </div>

            {/* Registration CTA */}
            <div className="fyt-tourney-reg-cta-wrap">
              <button
                type="button"
                className="fyt-btn-primary fyt-btn-register"
                onClick={() => window.open("https://docs.google.com/forms/d/e/1FAIpQLScxnTEoxYDsNd24k4q-mniTvw3c9gpMUzwbNRoiTaqebZk4ig/viewform", "_blank", "noopener,noreferrer")}
              >
                <ExternalLink size={16} />
                <span>Register Now</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />

    </div>
  );
}

function formatDate(date) {
  if (!date) return "-";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "-";
  return value.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function App() {
  // Quick visitor registration gate — shown once per browser before any
  // route renders. Existing routes below are completely unchanged.
  const [visitorReady, setVisitorReady] = useState(() => isVisitorRegistered());

  if (!visitorReady) {
    return <QuickRegister onComplete={() => setVisitorReady(true)} />;
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<QuickRegister onComplete={() => setVisitorReady(true)} />} />
      <Route path="/tournaments" element={<TournamentsPage />} />
      <Route path="/tournaments/:id" element={<TournamentDetails />} />
      <Route path="/events" element={<TournamentsPage />} />
      <Route path="/events/:id" element={<TournamentDetails />} />
      <Route path="/turfs" element={<BookTurf />} />
      <Route path="/turfs/:id" element={<TurfDetails />} />
      <Route path="/turfs/:id/checkout" element={<Checkout />} />
      <Route path="/addons" element={<AddonsCatalog />} />
      <Route path="/live" element={<UserLiveMatches />} />
      <Route path="/live/:id" element={<PublicMatchScorecard />} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/profile" element={<Profile />} />
    </Routes>
  );
}

export default App;
