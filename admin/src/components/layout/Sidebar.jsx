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
  IconIdCard,
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

  const groups = [
    {
      label: "Overview",
      items: [{ id: "overview", label: "Dashboard", icon: IconDashboard }],
    },
    {
      label: "Turf business",
      items: [
        { id: "bookings", label: "Bookings", icon: IconTicket, count: counts.bookings },
        { id: "turfs", label: "Turfs & owners", icon: IconMapPin },
        { id: "owner-alerts", label: "Owner alerts", icon: IconBell, count: counts.ownerAlerts },
        { id: "addons", label: "Add-on services", icon: IconSparkles },
      ],
    },
    {
      label: "Tournaments",
      items: [
        { id: "events", label: "Events", icon: IconCalendar, count: counts.events },
        { id: "live-matches", label: "Live matches", icon: IconLive },
      ],
    },
    {
      label: "Players & offers",
      items: [
        { id: "visitors", label: "Registered players", icon: IconUsers },
        { id: "enquiries", label: "Student & corporate", icon: IconIdCard, count: counts.enquiries },
        { id: "coupons", label: "Offers & coupons", icon: IconAward },
        { id: "community", label: "Community", icon: IconRadio },
      ],
    },
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
          {groups.map((group) => (
            <div key={group.label}>
              {!collapsed && <div className="nav-section-label">{group.label}</div>}
              {group.items.map((item) => {
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

                    {item.count !== undefined && item.count !== null && item.count > 0 && (
                      <span className="nav-badge">{item.count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
