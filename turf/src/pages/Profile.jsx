import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Pencil,
  Ticket,
  Gift,
  Users,
  Newspaper,
  GraduationCap,
  Building2,
  LifeBuoy,
  LogOut,
  ChevronRight,
  Check,
} from "lucide-react";
import { getProfile, saveProfile } from "../services/profile";
import Navbar, { LogoutDialog } from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import Footer from "../components/Footer";

const LINKS = [
  { to: "/bookings", label: "My bookings", desc: "Upcoming, past and cancelled games", Icon: Ticket },
  { to: "/rewards", label: "Rewards & coupons", desc: "Your points and discount codes", Icon: Gift },
  { to: "/players", label: "Find players", desc: "Host or join a game", Icon: Users },
  { to: "/community", label: "Community", desc: "Posts, tips and match results", Icon: Newspaper },
  { to: "/zones/student", label: "Student zone", desc: "Verify your ID for a discount", Icon: GraduationCap },
  { to: "/zones/corporate", label: "Corporate zone", desc: "Team outings and office leagues", Icon: Building2 },
  { to: "/help", label: "Help center", desc: "Guides, FAQs and contact", Icon: LifeBuoy },
];

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return parts.length ? (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase() : "?";
}

export default function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(() => getProfile());
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => getProfile() || { name: "", phone: "", email: "" });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: k === "phone" ? e.target.value.replace(/\D/g, "").slice(0, 10) : e.target.value }));

  const save = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError("Please enter your name.");
    if (!/^[6-9]\d{9}$/.test(form.phone)) return setError("Enter a valid 10-digit mobile number.");
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return setError("Enter a valid email address or leave it blank.");
    }
    const next = saveProfile({ name: form.name.trim(), phone: form.phone, email: form.email.trim() });
    setProfile(next);
    setEditing(false);
    setError("");
    setSaved(true);
    window.dispatchEvent(new Event("storage"));
    setTimeout(() => setSaved(false), 3000);
    return undefined;
  };

  return (
    <div className="fyt-app-shell">
      <Navbar />
      <main className="ui-page-main">
        <div className="ui-container" style={{ maxWidth: 980 }}>
          <div className="ui-pagehead"><h1>Account</h1></div>

          <div className="ui-profile-head">
            <span className="ui-avatar">{initials(profile?.name)}</span>
            <div className="grow">
              <h1>{profile?.name || "Guest player"}</h1>
              <p>
                {profile?.phone ? `+91 ${profile.phone}` : "Add your details to book faster"}
                {profile?.email ? ` · ${profile.email}` : ""}
              </p>
            </div>
            {!editing && (
              <button
                className="ui-btn ui-btn-secondary"
                onClick={() => {
                  setForm(profile || { name: "", phone: "", email: "" });
                  setEditing(true);
                }}
              >
                <Pencil size={15} /> Edit details
              </button>
            )}
          </div>

          {saved && (
            <div className="ui-alert success" style={{ marginTop: 16 }} role="status">
              <Check size={14} style={{ verticalAlign: "-2px" }} /> Your details were updated.
            </div>
          )}

          <div className="ui-cols-2" style={{ marginTop: 20 }}>
            <section className="ui-panel">
              <h3>Personal details</h3>
              {editing ? (
                <form onSubmit={save} noValidate>
                  <div className="ui-field">
                    <label htmlFor="pf-name">Full name</label>
                    <input id="pf-name" className="ui-input" value={form.name} onChange={set("name")} autoComplete="name" />
                  </div>
                  <div className="ui-field">
                    <label htmlFor="pf-phone">Mobile number</label>
                    <div className="ui-phone">
                      <span className="pre">+91</span>
                      <input id="pf-phone" className="ui-input" value={form.phone} onChange={set("phone")} inputMode="numeric" />
                    </div>
                    <div className="hint">Your bookings and rewards are linked to this number.</div>
                  </div>
                  <div className="ui-field">
                    <label htmlFor="pf-email">
                      Email <span style={{ color: "#94A3B8", fontWeight: 500 }}>(optional)</span>
                    </label>
                    <input id="pf-email" className="ui-input" type="email" value={form.email} onChange={set("email")} placeholder="name@example.com" />
                  </div>
                  {error && <div className="ui-alert error" role="alert">{error}</div>}
                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="submit" className="ui-btn ui-btn-primary">Save changes</button>
                    <button type="button" className="ui-btn ui-btn-secondary" onClick={() => { setEditing(false); setError(""); }}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <dl style={{ display: "grid", gap: 16, margin: 0 }}>
                  {[
                    ["Name", profile?.name],
                    ["Mobile number", profile?.phone ? `+91 ${profile.phone}` : ""],
                    ["Email", profile?.email],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt style={{ fontSize: 12.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em" }}>{k}</dt>
                      <dd style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 600 }}>
                        {v || <span style={{ color: "#94A3B8", fontWeight: 500 }}>Not added</span>}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>

            <section className="ui-panel">
              <h3>Quick links</h3>
              {LINKS.map(({ to, label, desc, Icon }) => (
                <button key={to} className="ui-list-item" onClick={() => navigate(to)}>
                  <span className="ico"><Icon size={19} /></span>
                  <span><b>{label}</b><span className="d">{desc}</span></span>
                  <ChevronRight size={18} className="chev" />
                </button>
              ))}
              <button className="ui-list-item danger" onClick={() => setConfirmLogout(true)}>
                <span className="ico"><LogOut size={19} /></span>
                <span><b>Log out</b><span className="d">Sign out on this device</span></span>
              </button>
            </section>
          </div>
        </div>
      </main>
      <Footer />
      <BottomNav />
      {confirmLogout && <LogoutDialog onCancel={() => setConfirmLogout(false)} />}
    </div>
  );
}
