import { Link } from "react-router-dom";
import {
  IconDashboard,
  IconCalendar,
  IconLive,
  IconMapPin,
  IconSparkles,
  IconUsers,
  IconX,
  IconShield,
  IconCollapse,
  IconTicket,
  IconAward,
  IconBell,
  IconRadio,
} from "../common/Icons";

export default function Sidebar({
  activeTab,
  setActiveTab,
  mobileOpen,
  setMobileOpen,
  collapsed = false,
  setCollapsed = null,
  counts = {},
}) {
  const handleNavClick = (tabId) => {
    setActiveTab(tabId);
    if (setMobileOpen) {
      setMobileOpen(false);
    }
  };

  const navItems = [
    { id: "overview", label: "Dashboard", icon: IconDashboard },
    { id: "events", label: "Events", icon: IconCalendar, count: counts.events },
    { id: "turfs", label: "Turfs", icon: IconMapPin, count: counts.turfs },
    { id: "addons", label: "Add-ons", icon: IconSparkles },
    { id: "bookings", label: "Bookings", icon: IconTicket, count: counts.bookings },
    { id: "visitors", label: "Visitors", icon: IconUsers },
    { id: "live-matches", label: "Live Matches", icon: IconLive },
    { id: "community", label: "Community", icon: IconRadio },
    { id: "enquiries", label: "Zone Requests", icon: IconBell, count: counts.enquiries },
    { id: "coupons", label: "Coupons", icon: IconAward },
  ];

  return (
    <>
      {mobileOpen && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 45 }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`admin-sidebar ${mobileOpen ? "mobile-open" : ""} ${
          collapsed ? "sidebar-collapsed" : ""
        }`}
      >
        <div className="sidebar-header">
          <Link
            to="/admin"
            className="brand-logo"
            onClick={() => handleNavClick("overview")}
            title="TURF HUB - SPORTS MANAGEMENT"
          >
            <div className="brand-icon-wrapper">
              <IconShield size={22} />
            </div>
            {!collapsed && (
              <div className="brand-text-block">
                <span className="brand-title">TURF HUB</span>
                <span className="brand-subtitle">SPORTS MANAGEMENT</span>
              </div>
            )}
          </Link>

          {setCollapsed && (
            <button
              className="sidebar-collapse-btn desktop-only"
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label="Toggle sidebar collapse"
            >
              <IconCollapse size={18} />
            </button>
          )}

          {mobileOpen && (
            <button
              className="topbar-icon-btn mobile-only"
              style={{
                width: "30px",
                height: "30px",
                color: "#ffffff",
                backgroundColor: "rgba(255,255,255,0.1)",
              }}
              onClick={() => setMobileOpen(false)}
              aria-label="Close sidebar"
            >
              <IconX size={16} />
            </button>
          )}
        </div>

        <div className="sidebar-nav-container">
          {!collapsed && <div className="nav-section-label">Main Menu</div>}

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                className={`nav-item ${isActive ? "active" : ""}`}
                onClick={() => handleNavClick(item.id)}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={19} />
                {!collapsed && <span>{item.label}</span>}

                {item.count !== undefined &&
                  item.count !== null &&
                  item.count > 0 && (
                    <span
                      className={`nav-badge ${
                        item.isLive ? "live-pulse-badge" : ""
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
              </button>
            );
          })}
        </div>
      </aside>
    </>
  );
}
