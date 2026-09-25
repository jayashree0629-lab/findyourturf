import { useLocation, useNavigate } from "react-router-dom";
import {
  Home as HomeIcon,
  Trophy,
  Calendar,
  PlayCircle,
  User,
} from "lucide-react";

const ITEMS = [
  { path: "/", label: "Home", Icon: HomeIcon },
  { path: "/turfs", label: "Book Turf", Icon: Calendar },
  { path: "/tournaments", altPath: "/events", label: "Tournaments", Icon: Trophy },
  { path: "/live", label: "Live Scores", Icon: PlayCircle },
  { path: "/profile", label: "Profile", Icon: User },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fyt-bottom-nav">
      <div className="fyt-bottom-nav-inner">
        {ITEMS.map(({ path, altPath, label, Icon }) => {
          const active =
            path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(path) || (altPath && location.pathname.startsWith(altPath));
          return (
            <button
              key={path}
              className={`fyt-bnav-item ${active ? "active" : ""}`}
              onClick={() => navigate(path)}
              aria-label={label}
            >
              <div className="fyt-bnav-icon-box">
                <Icon size={20} />
                {active && <span className="fyt-bnav-active-glow" />}
              </div>
              <span className="fyt-bnav-label">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
