import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  MapPin,
  Calendar,
  Trophy,
  PlayCircle,
  ChevronDown,
  LogOut,
  Ticket,
  Gift,
  UserRound,
  LifeBuoy,
  Users,
} from "lucide-react";
import { getNotificationsSeenAt, getIdentity, logout } from "../services/profile";

const navLinks = [
  { path: "/", label: "Home" },
  { path: "/turfs", label: "Book Turf", icon: Calendar },
  { path: "/tournaments", label: "Tournaments", icon: Trophy, altPath: "/events" },
  { path: "/live", label: "Live Scores", icon: PlayCircle },
  { path: "/community", label: "Community", altPaths: ["/players", "/chat", "/teams"] },
];

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
}

export function LogoutDialog({ onCancel }) {
  return (
    <div className="ui-overlay" role="presentation" onClick={onCancel}>
      <div className="ui-dialog" role="alertdialog" aria-modal="true" aria-labelledby="logout-title" onClick={(e) => e.stopPropagation()}>
        <span className="ui-dialog-icon danger"><LogOut size={22} /></span>
        <h2 id="logout-title">Log out?</h2>
        <p>You'll need to sign in again to see your bookings. Your bookings and points are safe — they stay linked to your mobile number.</p>
        <div className="ui-dialog-actions">
          <button className="ui-btn ui-btn-secondary" onClick={onCancel}>Stay signed in</button>
          <button className="ui-btn ui-btn-danger" onClick={logout} autoFocus>Log out</button>
        </div>
      </div>
    </div>
  );
}

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showBadge, setShowBadge] = useState(false);
  const [identity, setIdentity] = useState(() => getIdentity());
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    setShowBadge(!getNotificationsSeenAt());
    setMenuOpen(false);
    const sync = () => setIdentity(getIdentity());
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const esc = (e) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [menuOpen]);

  const isCurrent = (link) => {
    if (link.path === "/") return location.pathname === "/";
    return (
      location.pathname.startsWith(link.path) ||
      (link.altPath && location.pathname.startsWith(link.altPath)) ||
      (link.altPaths || []).some((p) => location.pathname.startsWith(p))
    );
  };

  const go = (to) => {
    setMenuOpen(false);
    navigate(to);
  };

  return (
    <header className="fyt-navbar">
      <div className="fyt-navbar-inner">
        {/* Left: Brand Logo */}
        <Link to="/" className="fyt-brand" aria-label="Find Your Turf Home">
          <div className="fyt-brand-icon">
            <span>F</span>
          </div>
          <div className="fyt-brand-text">
            <span className="fyt-brand-title">FindYour<span>Turf</span></span>
            <span className="fyt-brand-subtitle">Play • Book • Compete</span>
          </div>
        </Link>

        {/* Center (Desktop only): Navigation Links */}
        <nav className="fyt-nav-desktop">
          {navLinks.map((link) => {
            const active = isCurrent(link);
            return (
              <button
                key={link.path}
                className={`fyt-nav-link ${active ? "active" : ""}`}
                onClick={() => navigate(link.path)}
              >
                {link.label}
                {active && <span className="fyt-nav-active-pill" />}
              </button>
            );
          })}
        </nav>

        {/* Right: Actions */}
        <div className="fyt-header-actions">
          {/* Location Badge */}
          <div className="fyt-location-pill" title="Current Location">
            <MapPin size={15} className="fyt-loc-icon" />
            <span className="fyt-loc-text">Coimbatore</span>
          </div>

          {/* Notifications */}
          <button
            className="fyt-icon-btn"
            aria-label="Notifications"
            onClick={() => navigate("/notifications")}
            title="Notifications"
          >
            <Bell size={20} />
            {showBadge && <span className="fyt-notif-dot" />}
          </button>

          {/* Profile / Account */}
          <div className="ui-account" ref={menuRef}>
            <button
              className="fyt-profile-pill"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Profile"
              title="My Profile"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <div className="fyt-avatar-circle">
                {identity.name ? initials(identity.name) : <UserRound size={18} />}
              </div>
              <span className="fyt-profile-name">
                {identity.name ? identity.name.split(" ")[0] : "Account"}
              </span>
              <ChevronDown size={14} />
            </button>

            {menuOpen && (
              <div className="ui-menu" role="menu">
                <div className="ui-menu-head">
                  <span className="ui-avatar lg">{initials(identity.name)}</span>
                  <div>
                    <strong>{identity.name || "Guest player"}</strong>
                    <span>{identity.phone ? `+91 ${identity.phone}` : "Add your mobile number"}</span>
                  </div>
                </div>
                <button role="menuitem" onClick={() => go("/bookings")}><Ticket size={16} /> My bookings</button>
                <button role="menuitem" onClick={() => go("/rewards")}><Gift size={16} /> Rewards &amp; coupons</button>
                <button role="menuitem" onClick={() => go("/players")}><Users size={16} /> Find players</button>
                <button role="menuitem" onClick={() => go("/profile")}><UserRound size={16} /> Profile &amp; settings</button>
                <button role="menuitem" onClick={() => go("/help")}><LifeBuoy size={16} /> Help center</button>
                <hr />
                <button role="menuitem" className="danger" onClick={() => { setMenuOpen(false); setConfirmLogout(true); }}>
                  <LogOut size={16} /> Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {confirmLogout && <LogoutDialog onCancel={() => setConfirmLogout(false)} />}
    </header>
  );
}
