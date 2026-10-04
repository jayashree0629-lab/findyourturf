import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Search, X, SearchX } from "lucide-react";
import { getTurfs } from "../services/api";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import Footer from "../components/Footer";
import TurfCard, { TurfCardSkeletons, turfSportList } from "../components/TurfCard";
import EmptyState from "../components/EmptyState";

const SORTS = [
  { id: "recommended", label: "Recommended" },
  { id: "name_asc", label: "Name: A to Z" },
  { id: "name_desc", label: "Name: Z to A" },
  { id: "price_asc", label: "Price: Low to High" },
  { id: "price_desc", label: "Price: High to Low" },
];

export default function BookTurf() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  const [turfs, setTurfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState(params.get("q") || "");
  const [sport, setSport] = useState(params.get("sport") || "All");
  const [area, setArea] = useState("All");
  const [sortBy, setSortBy] = useState("recommended");

  useEffect(() => {
    let active = true;
    getTurfs()
      .then((data) => active && setTurfs(Array.isArray(data) ? data : []))
      .catch((err) => active && setError(err.message || "Couldn't load turfs."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // Filter options are built from the turfs that actually exist.
  const sportOptions = useMemo(() => {
    const set = new Set();
    turfs.forEach((t) => turfSportList(t).forEach((s) => set.add(s)));
    return ["All", ...[...set].sort((a, b) => a.localeCompare(b))];
  }, [turfs]);

  const areaOptions = useMemo(() => {
    const set = new Set(turfs.map((t) => t.location).filter(Boolean));
    return ["All", ...[...set].sort((a, b) => a.localeCompare(b))];
  }, [turfs]);

  const shown = useMemo(() => {
    let list = [...turfs];
    if (sport !== "All") {
      const want = sport.toLowerCase();
      list = list.filter((t) => turfSportList(t).some((s) => s.toLowerCase() === want));
    }
    if (area !== "All") list = list.filter((t) => t.location === area);

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          (t.name || "").toLowerCase().includes(q) ||
          (t.location || "").toLowerCase().includes(q) ||
          (t.address || "").toLowerCase().includes(q) ||
          turfSportList(t).some((s) => s.toLowerCase().includes(q))
      );
    }

    const byName = (a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
    if (sortBy === "name_asc") list.sort(byName);
    else if (sortBy === "name_desc") list.sort((a, b) => byName(b, a));
    else if (sortBy === "price_asc") list.sort((a, b) => (a.pricePerHour || Infinity) - (b.pricePerHour || Infinity));
    else if (sortBy === "price_desc") list.sort((a, b) => (b.pricePerHour || -1) - (a.pricePerHour || -1));
    else {
      // Turfs you can book online come first.
      list.sort((a, b) => Number(b.pricePerHour > 0) - Number(a.pricePerHour > 0));
    }
    return list;
  }, [turfs, sport, area, query, sortBy]);

  const reset = () => {
    setQuery("");
    setSport("All");
    setArea("All");
    setSortBy("recommended");
  };
  const filtered = query || sport !== "All" || area !== "All";

  return (
    <div className="fyt-app-shell">
      <Navbar />
      <main className="ui-page-main">
        <div className="ui-container">
          <div className="ui-pagehead">
            <h1>Book a turf</h1>
            <p>Choose a venue in Coimbatore, pick a date and time, and confirm your slot in a minute.</p>
          </div>

          <div className="ui-filterbar">
            <div className="ui-input-wrap">
              <Search size={18} className="lead" />
              <input
                className="ui-input with-icon"
                type="search"
                placeholder="Search by turf name, area or sport"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search turfs"
              />
              {query && (
                <button className="ui-clear" onClick={() => setQuery("")} aria-label="Clear search"><X size={16} /></button>
              )}
            </div>
            <select className="ui-input" style={{ width: "auto", minWidth: 160 }} value={area} onChange={(e) => setArea(e.target.value)} aria-label="Filter by area">
              {areaOptions.map((a) => <option key={a} value={a}>{a === "All" ? "All areas" : a}</option>)}
            </select>
            <select className="ui-input" style={{ width: "auto", minWidth: 180 }} value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort turfs">
              {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>

          <div className="ui-chiprow" role="group" aria-label="Filter by sport">
            {sportOptions.map((s) => (
              <button key={s} className={`ui-chip ${sport === s ? "active" : ""}`} onClick={() => setSport(s)}>
                {s === "All" ? "All sports" : s}
              </button>
            ))}
          </div>

          <p className="ui-count">
            {loading ? "Loading turfs…" : <>Showing <b>{shown.length}</b> of {turfs.length} turf{turfs.length === 1 ? "" : "s"}</>}
            {filtered && !loading && (
              <button className="ui-btn ui-btn-ghost ui-btn-sm" style={{ marginLeft: 8 }} onClick={reset}>Clear filters</button>
            )}
          </p>

          {error ? (
            <EmptyState type="error" title="Couldn't load turfs" message={error} actionLabel="Try again" onAction={() => window.location.reload()} />
          ) : loading ? (
            <TurfCardSkeletons />
          ) : shown.length === 0 ? (
            <EmptyState
              icon={<SearchX size={36} />}
              title="No turfs match your search"
              message="Try a different name, area or sport."
              actionLabel="Clear filters"
              onAction={reset}
            />
          ) : (
            <div className="ui-grid">
              {shown.map((turf, idx) => (
                <TurfCard key={turf._id} turf={turf} index={idx} />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
