import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Pencil,
  LogOut,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Ticket,
  Gift,
  Users,
  Newspaper,
  GraduationCap,
  Building2,
} from "lucide-react";
import {
  getProfile,
  saveProfile,
  clearProfile,
  getLocalBookings,
} from "../services/profile";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import EmptyState from "../components/EmptyState";
import { SPORTS_IMAGES } from "../utils/sportsImages";

export default function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(() => getProfile());
  const [editing, setEditing] = useState(() => !getProfile());
  const [form, setForm] = useState(
    () => getProfile() || { name: "", phone: "", email: "" }
  );
  const [error, setError] = useState("");
  const [bookings, setBookings] = useState(() => getLocalBookings());

  useEffect(() => {
    setBookings(getLocalBookings());
  }, []);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      setError("Full name and mobile number are required.");
      return;
    }
    if (!/^\d{10}$/.test(form.phone.trim())) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    const saved = saveProfile({
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
    });
    setProfile(saved);
    setEditing(false);
    setError("");
  };

  const handleSignOut = () => {
    if (window.confirm("Are you sure you want to clear your stored player profile on this device?")) {
      clearProfile();
      setProfile(null);
      setForm({ name: "", phone: "", email: "" });
      setEditing(true);
    }
  };

  return (
    <div className="fyt-app-shell">
      <Navbar />

      <main className="fyt-main-content" style={{ paddingBottom: 110 }}>
        <div className="fyt-container" style={{ maxWidth: 860 }}>
          {/* Profile Hero Card */}
          <div className="fyt-card fyt-profile-hero-card">
            <div className="fyt-ph-left">
              <div className="fyt-ph-avatar">
                {profile?.name ? profile.name.charAt(0).toUpperCase() : <User size={32} />}
              </div>
              <div className="fyt-ph-info">
                <div className="fyt-ph-badge">
                  <Sparkles size={12} /> <span>Turf Player</span>
                </div>
                <h1 className="fyt-ph-name">{profile?.name || "Guest Player"}</h1>
                <p className="fyt-ph-contact">
                  {profile?.phone ? `+91 ${profile.phone}` : "Set up your player profile to book slots faster"}
                </p>
              </div>
            </div>

            {!editing && profile && (
              <button
                className="fyt-btn-edit-profile"
                onClick={() => setEditing(true)}
              >
                <Pencil size={15} />
                <span>Edit Profile</span>
              </button>
            )}
          </div>

          {/* Profile Form (if editing) or Details Summary */}
          {editing ? (
            <div className="fyt-card fyt-profile-form-card" style={{ marginTop: 20 }}>
              <h3 className="fyt-card-heading">
                {profile ? "Edit Player Details" : "Create Player Profile"}
              </h3>
              <form onSubmit={handleSave} className="fyt-profile-form">
                <div className="fyt-form-group">
                  <label>Full Name *</label>
                  <div className="fyt-input-with-icon">
                    <User size={16} />
                    <input
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="e.g. Karthik Raj"
                      required
                    />
                  </div>
                </div>

                <div className="fyt-form-group">
                  <label>Mobile Number *</label>
                  <div className="fyt-input-with-icon">
                    <Phone size={16} />
                    <input
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="10-digit phone number"
                      inputMode="numeric"
                      required
                    />
                  </div>
                </div>

                <div className="fyt-form-group">
                  <label>Email Address (Optional)</label>
                  <div className="fyt-input-with-icon">
                    <Mail size={16} />
                    <input
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="e.g. karthik@example.com"
                    />
                  </div>
                </div>

                {error && <div className="fyt-error-banner">{error}</div>}

                <div className="fyt-form-actions-row">
                  <button type="submit" className="fyt-btn-primary">
                    Save Profile
                  </button>
                  {profile && (
                    <button
                      type="button"
                      className="fyt-btn-secondary"
                      onClick={() => {
                        setForm(profile);
                        setEditing(false);
                        setError("");
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          ) : (
            <div className="fyt-card fyt-profile-details-card" style={{ marginTop: 20 }}>
              <h3 className="fyt-card-heading">Contact Information</h3>
              <div className="fyt-pd-grid">
                <div className="fyt-pd-item">
                  <span className="fyt-pd-label"><Phone size={14} /> Phone Number</span>
                  <strong className="fyt-pd-val">+91 {profile.phone}</strong>
                </div>

                {profile.email && (
                  <div className="fyt-pd-item">
                    <span className="fyt-pd-label"><Mail size={14} /> Email</span>
                    <strong className="fyt-pd-val">{profile.email}</strong>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick links to everything else the app does */}
          <section style={{ marginTop: 24 }}>
            <div className="fyt-x-links">
              {[
                { to: "/bookings", label: "My Bookings", hint: "Manage or cancel", Icon: Ticket },
                { to: "/rewards", label: "Rewards", hint: "Points & coupons", Icon: Gift },
                { to: "/players", label: "Find Players", hint: "Join or host a game", Icon: Users },
                { to: "/community", label: "Community", hint: "Posts & chat", Icon: Newspaper },
                { to: "/zones/student", label: "Student Zone", hint: "Student discounts", Icon: GraduationCap },
                { to: "/zones/corporate", label: "Corporate Zone", hint: "Team events", Icon: Building2 },
              ].map(({ to, label, hint, Icon }) => (
                <button key={to} className="fyt-x-link-tile" onClick={() => navigate(to)}>
                  <Icon size={20} />
                  <span>{label}</span>
                  <small>{hint}</small>
                </button>
              ))}
            </div>
          </section>

          {/* Bookings History Section */}
          <section className="fyt-my-bookings-section" style={{ marginTop: 28 }}>
            <div className="fyt-section-header-row">
              <h2 className="fyt-section-title">Recent Bookings</h2>
              <button className="fyt-x-btn-ghost" onClick={() => navigate("/bookings")}>
                Manage all bookings →
              </button>
            </div>

            {bookings.length === 0 ? (
              <EmptyState
                type="bookings"
                title="No turf bookings yet"
                message="You haven't reserved any turf slots yet. Explore venues in Coimbatore and book your first game!"
                actionLabel="Explore & Book Turfs"
                onAction={() => navigate("/turfs")}
              />
            ) : (
              <div className="fyt-bookings-list">
                {bookings.map((booking, idx) => (
                  <div key={idx} className="fyt-card fyt-booking-history-card">
                    <div className="fyt-bhc-header">
                      <div className="fyt-bhc-title-group">
                        <h3 className="fyt-bhc-turf-name">{booking.turfName}</h3>
                        {booking.turfLocation && (
                          <div className="fyt-bhc-loc">
                            <MapPin size={13} /> <span>{booking.turfLocation}</span>
                          </div>
                        )}
                      </div>

                      <span className={`fyt-status-badge ${booking.status?.toLowerCase() || "confirmed"}`}>
                        <CheckCircle2 size={12} /> {booking.status || "Confirmed"}
                      </span>
                    </div>

                    <div className="fyt-bhc-divider" />

                    <div className="fyt-bhc-meta-row">
                      <div className="fyt-bhc-meta-item">
                        <Calendar size={14} className="fyt-meta-icon" />
                        <span>
                          {booking.date
                            ? new Date(booking.date).toLocaleDateString("en-IN", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "-"}
                        </span>
                      </div>

                      <div className="fyt-bhc-meta-item">
                        <Clock size={14} className="fyt-meta-icon" />
                        <span>
                          {booking.endSlot
                            ? `${booking.slot} – ${booking.endSlot}`
                            : booking.slot}
                        </span>
                      </div>

                      <div className="fyt-bhc-amount">
                        <span>Paid:</span>
                        <strong>₹{booking.totalAmount}</strong>
                      </div>
                    </div>

                    {(booking.players > 1 || booking.perPersonAmount) && (
                      <div
                        className="fyt-bhc-split-row"
                        style={{
                          marginTop: 10,
                          paddingTop: 10,
                          borderTop: "1px dashed var(--border-color, #e5e7eb)",
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "0.85rem",
                          color: "var(--text-secondary)",
                        }}
                      >
                        <span>
                          Split {booking.players || 1} ways
                          {booking.floodlightAmount ? " · incl. floodlight" : ""}
                        </span>
                        <strong style={{ color: "var(--primary)" }}>
                          ₹{booking.perPersonAmount} / person
                        </strong>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Sign Out / Reset Button */}
          {profile && (
            <div style={{ marginTop: 32, textAlign: "center" }}>
              <button className="fyt-btn-signout" onClick={handleSignOut}>
                <LogOut size={16} /> <span>Clear Stored Details</span>
              </button>
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
