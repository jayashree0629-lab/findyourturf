import { useNavigate, useLocation, Link } from "react-router-dom";
import { ArrowLeft, Users, MessageCircle, Newspaper, Shuffle } from "lucide-react";
import Navbar from "./Navbar";
import BottomNav from "./BottomNav";

// Shared page frame for the newer screens: navbar, back button, heading and
// bottom nav, so every screen looks and behaves the same.
// `bare` drops the back button and heading so a full-height screen (like a
// chat room) can use the whole viewport.
export default function PageShell({ title, subtitle, actions, maxWidth = 1100, back = true, bare = false, children }) {
  const navigate = useNavigate();

  return (
    <div className="fyt-app-shell">
      <Navbar />
      <main className="fyt-main-content" style={{ paddingBottom: 110 }}>
        <div className="fyt-container fyt-x-page" style={{ maxWidth }}>
          {back && !bare && (
            <div className="fyt-td-nav-bar">
              <button className="fyt-back-btn" onClick={() => navigate(-1)} aria-label="Go Back">
                <ArrowLeft size={18} />
                <span>Back</span>
              </button>
            </div>
          )}
          {!bare && (
            <div className="fyt-x-head">
              <div>
                <h1>{title}</h1>
                {subtitle && <p>{subtitle}</p>}
              </div>
              {actions && <div className="fyt-x-head-actions">{actions}</div>}
            </div>
          )}
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

const COMMUNITY_TABS = [
  { path: "/community", label: "Feed", Icon: Newspaper },
  { path: "/players", label: "Find Players", Icon: Users },
  { path: "/chat", label: "Team Chat", Icon: MessageCircle },
  { path: "/teams", label: "Auto Teams", Icon: Shuffle },
];

export function CommunityTabs() {
  const { pathname } = useLocation();
  return (
    <nav className="fyt-x-tabs" aria-label="Community sections">
      {COMMUNITY_TABS.map(({ path, label, Icon }) => (
        <Link
          key={path}
          to={path}
          className={`fyt-x-tab ${pathname === path || pathname.startsWith(`${path}/`) ? "active" : ""}`}
        >
          <Icon size={16} /> {label}
        </Link>
      ))}
    </nav>
  );
}

export function SkeletonList({ count = 3, height = 140 }) {
  return (
    <div className="fyt-x-grid">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="fyt-x-skel" style={{ minHeight: height }} />
      ))}
    </div>
  );
}
