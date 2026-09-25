import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, User, MapPin, Calendar, Trophy, PlayCircle } from "lucide-react";
import { getNotificationsSeenAt, getProfile } from "../services/profile";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showBadge, setShowBadge] = useState(false);
  const [profile, setProfile] = useState(() => getProfile());

  useEffect(() => {
    setShowBadge(!getNotificationsSeenAt());
    const handleStorage = () => setProfile(getProfile());
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [location.pathname]);

  const navLinks = [
    { path: "/", label: "Home" },
    { path: "/turfs", label: "Book Turf", icon: Calendar },
    { path: "/tournaments", label: "Tournaments", icon: Trophy, altPath: "/events" },
    { path: "/live", label: "Live Scores", icon: PlayCircle },
    { path: "/community", label: "Community", altPaths: ["/players", "/chat", "/teams"] },
  ];

  const isCurrent = (link) => {
    if (link.path === "/") return location.pathname === "/";
    return (
      location.pathname.startsWith(link.path) ||
      (link.altPath && location.pathname.startsWith(link.altPath)) ||
      (link.altPaths || []).some((p) => location.pathname.startsWith(p))
    );
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
          <button
            className="fyt-profile-pill"
            aria-label="Profile"
            onClick={() => navigate("/profile")}
            title="My Profile"
          >
            <div className="fyt-avatar-circle">
              <User size={18} />
            </div>
            <span className="fyt-profile-name">
              {profile?.name ? profile.name.split(" ")[0] : "Account"}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
