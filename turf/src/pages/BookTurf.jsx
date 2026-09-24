import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal, ArrowLeft, X, Sparkles } from "lucide-react";
import { getTurfs } from "../services/api";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import TurfCard from "../components/TurfCard";
import { TurfCardSkeleton } from "../components/SkeletonLoader";
import EmptyState from "../components/EmptyState";

const SPORTS = [
  { id: "ALL", name: "All Sports", icon: "🏆" },
  { id: "Football", name: "Football", icon: "⚽" },
  { id: "Cricket", name: "Cricket", icon: "🏏" },
  { id: "Box Cricket", name: "Box Cricket", icon: "🏏" },
  { id: "Pickleball", name: "Pickleball", icon: "🎾" },
];

function turfSports(t) {
  const list = Array.isArray(t.sports) && t.sports.length ? t.sports : t.sportType ? [t.sportType] : [];
  return list.map((s) => String(s).toLowerCase());
}

export default function BookTurf() {
  const navigate = useNavigate();
  const location = useLocation();
  const [turfs, setTurfs] = useState([]);
  const [loading, setLoading] = useState(true);

  const searchParams = new URLSearchParams(location.search);
  const initialSport = searchParams.get("sport") || "ALL";
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [selectedSport, setSelectedSport] = useState(initialSport);
  const [sortBy, setSortBy] = useState("recommended");

  const dateChips = useMemo(() => {
    const chips = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
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
  }, []);

  const [selectedDate, setSelectedDate] = useState(dateChips[0].fullDate);

  useEffect(() => {
    async function loadTurfs() {
      try {
        setLoading(true);
        const data = await getTurfs();
        // The booking catalogue shows every configured turf. Slot availability
        // is checked on the detail/checkout flow instead of hiding venues here.
        const list = Array.isArray(data) ? data : [];
        setTurfs(list);
      } catch (err) {
        console.error("Failed to load turfs:", err);
      } finally {
        setLoading(false);
      }
    }
    loadTurfs();
  }, []);

  const filteredTurfs = useMemo(() => {
    let list = [...turfs];

    if (selectedSport && selectedSport !== "ALL") {
      const want = selectedSport.toLowerCase();
      list = list.filter((t) => turfSports(t).some((s) => s.includes(want) || want.includes(s)));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (t) =>
          (t.name || "").toLowerCase().includes(q) ||
          (t.location || "").toLowerCase().includes(q) ||
          (t.address || "").toLowerCase().includes(q) ||
          turfSports(t).some((s) => s.includes(q))
      );
    }

    if (sortBy === "price_asc") {
      list.sort((a, b) => (a.pricePerHour ?? Infinity) - (b.pricePerHour ?? Infinity));
    } else if (sortBy === "price_desc") {
      list.sort((a, b) => (b.pricePerHour ?? -1) - (a.pricePerHour ?? -1));
    }
    return list;
  }, [turfs, selectedSport, searchQuery, sortBy]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedSport("ALL");
    setSortBy("recommended");
  };

  return (
    <div className="fyt-app-shell">
      <Navbar />

      <main className="fyt-main-content" style={{ paddingBottom: 110 }}>
        <div className="fyt-page-banner">
          <div className="fyt-container">
            <div className="fyt-td-nav-bar" style={{ padding: 0, marginBottom: 12 }}>
              <button className="fyt-back-btn" onClick={() => navigate(-1)} aria-label="Go Back">
                <ArrowLeft size={18} />
                <span>Back</span>
              </button>
              <div className="fyt-pb-badge" style={{ margin: 0 }}>
                <Sparkles size={14} /> <span>Coimbatore Turfs</span>
              </div>
            </div>

            <div className="fyt-pb-content">
              <h1 className="fyt-pb-title">Book Your Turf</h1>
              <p className="fyt-pb-desc">
                Real turf venues across Coimbatore. Pick a date and time slot to book.
              </p>
            </div>

            <div className="fyt-search-bar-wrap">
              <div className="fyt-search-box">
                <Search size={20} className="fyt-search-icon" />
                <input
                  type="text"
                  placeholder="Search turf or area (Singanallur, Peelamedu, Ganapathy)…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="fyt-search-input"
                />
                {searchQuery && (
                  <button className="fyt-search-clear" onClick={() => setSearchQuery("")} aria-label="Clear search">
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <section className="fyt-filters-section">
          <div className="fyt-container">
            <div className="fyt-filter-group">
              <span className="fyt-filter-group-label">Sport:</span>
              <div className="fyt-chips-scroll">
                {SPORTS.map((sport) => (
                  <button
                    key={sport.id}
                    className={`fyt-sport-chip ${selectedSport === sport.id ? "active" : ""}`}
                    onClick={() => setSelectedSport(sport.id)}
                  >
                    <span className="fyt-chip-icon">{sport.icon}</span>
                    <span>{sport.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="fyt-filter-group" style={{ marginTop: 12 }}>
              <span className="fyt-filter-group-label">Date:</span>
              <div className="fyt-chips-scroll">
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

            <div className="fyt-subfilter-bar">
              <div className="fyt-results-counter">
                Showing <strong>{filteredTurfs.length}</strong> turf{filteredTurfs.length === 1 ? "" : "s"}
                {selectedSport !== "ALL" && ` for ${selectedSport}`}
              </div>

              <div className="fyt-sort-dropdown-wrap">
                <SlidersHorizontal size={14} className="fyt-sort-icon" />
                <select
                  className="fyt-sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  aria-label="Sort Turfs"
                >
                  <option value="recommended">Recommended</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="fyt-turfs-grid-section" style={{ paddingBottom: 24 }}>
          <div className="fyt-container">
            <div className="fyt-section-header-row" style={{ marginBottom: 16 }}>
              <div>
                <span className="fyt-section-kicker">COIMBATORE</span>
                <h2 className="fyt-section-title">Turf Venues</h2>
              </div>
            </div>

            {loading ? (
              <div className="fyt-grid-3">
                {[1, 2, 3].map((n) => (
                  <TurfCardSkeleton key={n} />
                ))}
              </div>
            ) : filteredTurfs.length === 0 ? (
              <EmptyState
                type="turfs"
                title="No turfs found"
                message="Try changing your search or sport filter."
                actionLabel="Reset Filters"
                onAction={handleResetFilters}
              />
            ) : (
              <div className="fyt-grid-3">
                {filteredTurfs.map((turf, idx) => (
                  <TurfCard key={turf._id} turf={turf} index={idx} />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
