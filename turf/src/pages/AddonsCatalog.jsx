import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Video, Users, Dumbbell, Star, Search, X, SearchX } from "lucide-react";
import { getAddons } from "../services/api";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import Footer from "../components/Footer";
import EmptyState from "../components/EmptyState";

const CATEGORIES = [
  { type: "all", title: "All" },
  { type: "photography", title: "Photography", Icon: Camera },
  { type: "videography", title: "Videography", Icon: Video },
  { type: "coach", title: "Coaches", Icon: Users },
  { type: "equipment", title: "Equipment", Icon: Dumbbell },
];
const TYPE_LABEL = { photography: "Photography", videography: "Videography", coach: "Coach", equipment: "Equipment" };

const SORTS = [
  { id: "name_asc", label: "Name: A to Z" },
  { id: "name_desc", label: "Name: Z to A" },
  { id: "price_asc", label: "Price: Low to High" },
  { id: "price_desc", label: "Price: High to Low" },
];

function ServiceCard({ s }) {
  const details = s.description || s.packageDetails || s.specialization || "";
  return (
    <article className="ui-turf" style={{ cursor: "default" }}>
      {s.image ? (
        <div className="ui-turf-media" style={{ aspectRatio: "16 / 9" }}>
          <img src={s.image} alt="" loading="lazy" />
          <span className="ui-turf-badge">{TYPE_LABEL[s.type] || s.type}</span>
        </div>
      ) : null}
      <div className="ui-turf-body">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
          <h3 className="ui-turf-title">{s.name}</h3>
          {!s.image && <span className="ui-tag">{TYPE_LABEL[s.type] || s.type}</span>}
        </div>
        {details && <p style={{ color: "var(--ui-muted)", fontSize: 14, lineHeight: 1.5 }}>{details}</p>}
        <div className="ui-tags">
          {s.sport && <span className="ui-tag">{s.sport}</span>}
          {s.experienceYears != null && <span className="ui-tag">{s.experienceYears} yrs experience</span>}
          {s.durationLabel && <span className="ui-tag">{s.durationLabel}</span>}
          {s.type === "equipment" && <span className={`ui-tag ${s.stock > 0 ? "green" : ""}`}>{s.stock} in stock</span>}
          {s.rating != null && (
            <span className="ui-tag"><Star size={12} fill="#f59e0b" color="#f59e0b" /> {s.rating}</span>
          )}
        </div>
        <div className="ui-turf-foot">
          <div className="ui-price">
            <small>Price</small>
            <strong>₹{s.price}{s.priceUnit ? <i> / {s.priceUnit}</i> : null}</strong>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function AddonsCatalog() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sortBy, setSortBy] = useState("name_asc");

  useEffect(() => {
    let active = true;
    getAddons()
      .then((list) => active && setItems(list))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter((s) => {
      if (category !== "all" && s.type !== category) return false;
      if (!q) return true;
      return [s.name, s.description, s.sport, s.specialization, s.packageDetails, TYPE_LABEL[s.type]]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
    const byName = (a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
    if (sortBy === "name_desc") list.sort((a, b) => byName(b, a));
    else if (sortBy === "price_asc") list.sort((a, b) => (a.price || 0) - (b.price || 0));
    else if (sortBy === "price_desc") list.sort((a, b) => (b.price || 0) - (a.price || 0));
    else list.sort(byName);
    return list;
  }, [items, query, category, sortBy]);

  const reset = () => {
    setQuery("");
    setCategory("all");
    setSortBy("name_asc");
  };

  return (
    <div className="fyt-app-shell">
      <Navbar />
      <main className="ui-page-main">
        <div className="ui-container">
          <div className="ui-pagehead">
            <h1>Session add-ons</h1>
            <p>Photographers, coaches and equipment you can add to any turf booking at checkout.</p>
          </div>

          <div className="ui-filterbar">
            <div className="ui-input-wrap">
              <Search size={18} className="lead" />
              <input
                className="ui-input with-icon"
                type="search"
                placeholder="Search add-ons, e.g. coach or camera"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search add-ons"
              />
              {query && <button className="ui-clear" onClick={() => setQuery("")} aria-label="Clear search"><X size={16} /></button>}
            </div>
            <select className="ui-input" style={{ width: "auto", minWidth: 180 }} value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort add-ons">
              {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <button className="ui-btn ui-btn-primary" onClick={() => navigate("/turfs")}>Book a turf to add these</button>
          </div>

          <div className="ui-chiprow" role="group" aria-label="Filter by category">
            {CATEGORIES.map((c) => (
              <button key={c.type} className={`ui-chip ${category === c.type ? "active" : ""}`} onClick={() => setCategory(c.type)}>
                {c.Icon ? <c.Icon size={15} /> : null} {c.title}
              </button>
            ))}
          </div>

          <p className="ui-count">
            {loading ? "Loading add-ons…" : <>Showing <b>{shown.length}</b> of {items.length}</>}
          </p>

          {loading ? (
            <div className="ui-grid">{[1, 2, 3].map((n) => <div key={n} className="ui-skel" />)}</div>
          ) : shown.length === 0 ? (
            <EmptyState icon={<SearchX size={36} />} title="No add-ons found" message="Try a different search or category." actionLabel="Clear filters" onAction={reset} />
          ) : (
            <div className="ui-grid">
              {shown.map((s) => <ServiceCard key={s._id} s={s} />)}
            </div>
          )}
        </div>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
