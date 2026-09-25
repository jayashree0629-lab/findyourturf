import { useCallback, useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { GraduationCap, Building2, BadgePercent, CalendarClock, Users, Trophy, Copy, CheckCircle2, Clock } from "lucide-react";
import PageShell from "../components/PageShell";
import { useIdentity, useToast } from "../components/AppProviders";
import { submitZoneEnquiry, getMyZoneEnquiries } from "../services/api";

const ZONES = {
  student: {
    title: "Student Zone",
    subtitle: "Play more, pay less. Verified students get a personal discount code for weekday games.",
    Icon: GraduationCap,
    orgLabel: "College / university",
    orgPlaceholder: "e.g. PSG College of Technology",
    detailLabel: "Course & year",
    detailPlaceholder: "e.g. B.E. CSE, 3rd year",
    sizeLabel: "Team size",
    messageHint: "Anything else? e.g. inter-college match, weekday evenings…",
    benefits: [
      { Icon: BadgePercent, title: "Student discount", text: "A personal coupon on turf bookings once your student status is verified." },
      { Icon: CalendarClock, title: "Off-peak friendly", text: "Great for weekday afternoons and evenings when turfs have the most room." },
      { Icon: Trophy, title: "Inter-college games", text: "Tell us about your college team and we'll help arrange fixtures." },
    ],
    steps: [
      "Fill in the short form with your college details.",
      "Our team reviews it — usually within one working day.",
      "Once approved, your discount code shows up right here and in your rewards wallet.",
    ],
  },
  corporate: {
    title: "Corporate Zone",
    subtitle: "Team outings, office leagues and company tournaments — planned for you.",
    Icon: Building2,
    orgLabel: "Company name",
    orgPlaceholder: "e.g. Kovai Tech Pvt Ltd",
    detailLabel: "Your role",
    detailPlaceholder: "e.g. HR Manager",
    sizeLabel: "Approx. team members",
    messageHint: "Tell us about the event: sport, dates, budget, catering…",
    benefits: [
      { Icon: Users, title: "Group bookings", text: "Multiple turfs and back-to-back slots for large groups." },
      { Icon: Trophy, title: "Office tournaments", text: "Fixtures, scoring and live scoreboards for your company league." },
      { Icon: BadgePercent, title: "Corporate rates", text: "Custom pricing for regular or bulk bookings." },
    ],
    steps: [
      "Share your requirements — sport, group size and preferred dates.",
      "We'll call you to understand the event and suggest the best venues.",
      "Confirm the plan and we'll handle slots, add-ons and scoring.",
    ],
  },
};

const STATUS_TONE = { New: "info", "In Review": "warn", Approved: "success", Rejected: "danger", Closed: "" };

function fmtDate(v) {
  return new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function ZonePage() {
  const { zone: zoneParam } = useParams();
  const zone = ZONES[zoneParam];
  const toast = useToast();
  const { identity, requireIdentity } = useIdentity();

  const [form, setForm] = useState({ organization: "", detail: "", groupSize: 1, sport: "", preferredDate: "", email: "", message: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState([]);

  const loadMine = useCallback(async () => {
    if (!identity.ready) return;
    try {
      const all = await getMyZoneEnquiries(identity.phone);
      setMine(all.filter((e) => e.zone === zoneParam));
    } catch {
      /* non-critical */
    }
  }, [identity.ready, identity.phone, zoneParam]);

  useEffect(() => {
    loadMine();
  }, [loadMine]);

  if (!zone) return <Navigate to="/" replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const active = mine.find((e) => e.status === "New" || e.status === "In Review");
  const approved = mine.find((e) => e.status === "Approved");

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.organization.trim()) next.organization = `Please enter your ${zone.orgLabel.toLowerCase()}.`;
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "Enter a valid email or leave it blank.";
    setErrors(next);
    if (Object.keys(next).length) return;

    const id = identity.ready ? identity : await requireIdentity("We'll contact you on this number about your request.");
    if (!id || !id.ready) return;

    setBusy(true);
    try {
      await submitZoneEnquiry({
        zone: zoneParam,
        name: id.name,
        phone: id.phone,
        ...form,
        groupSize: Number(form.groupSize) || 1,
        preferredDate: form.preferredDate || undefined,
      });
      toast.success("Request sent! We'll be in touch soon.");
      setForm({ organization: "", detail: "", groupSize: 1, sport: "", preferredDate: "", email: "", message: "" });
      await loadMine();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`${code} copied.`);
    } catch {
      toast.error("Couldn't copy the code.");
    }
  };

  return (
    <PageShell title={zone.title} subtitle={zone.subtitle} maxWidth={900}>
      {approved && (
        <div className="fyt-x-card fyt-x-stack" style={{ marginBottom: 18, borderColor: "#A7F3D0", background: "var(--color-success-bg)" }}>
          <div className="fyt-x-row"><CheckCircle2 color="#047857" /> <strong style={{ color: "#047857" }}>You're approved for {zone.title}!</strong></div>
          {approved.couponCode ? (
            <div className="fyt-x-coupon" style={{ background: "#fff" }}>
              <div>
                <code>{approved.couponCode}</code>
                <div className="fyt-x-sub">Enter this at checkout when you book a turf.</div>
              </div>
              <button className="fyt-btn-secondary fyt-x-btn-sm" onClick={() => copyCode(approved.couponCode)}><Copy size={13} /> Copy</button>
            </div>
          ) : (
            <p className="fyt-x-sub">Our team will contact you with the next steps.</p>
          )}
          {approved.adminNote && <p className="fyt-x-sub">“{approved.adminNote}”</p>}
        </div>
      )}

      <section className="fyt-x-benefits" style={{ marginBottom: 20 }}>
        {zone.benefits.map(({ Icon, title, text }) => (
          <div key={title} className="fyt-x-card fyt-x-benefit">
            <span className="fyt-x-benefit-icon"><Icon size={20} /></span>
            <div><strong>{title}</strong><p className="fyt-x-sub" style={{ marginTop: 3, lineHeight: 1.5 }}>{text}</p></div>
          </div>
        ))}
      </section>

      <div className="fyt-x-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", alignItems: "start" }}>
        <section className="fyt-x-card">
          <h2 className="fyt-x-card-title" style={{ marginBottom: 14 }}>
            {active ? "Your request is with our team" : `Apply for ${zone.title}`}
          </h2>
          {active ? (
            <div className="fyt-x-stack">
              <div className="fyt-x-inline-msg info">
                <Clock size={14} style={{ verticalAlign: "-2px" }} /> We received your request for <strong>{active.organization}</strong> on {fmtDate(active.createdAt)}. We'll contact you on +91 {identity.phone} shortly.
              </div>
            </div>
          ) : (
            <form className="fyt-x-stack" onSubmit={submit} noValidate>
              <div className="fyt-x-field">
                <label htmlFor="z-org">{zone.orgLabel} *</label>
                <input id="z-org" className="fyt-x-input" value={form.organization} onChange={set("organization")} placeholder={zone.orgPlaceholder} maxLength={100} />
                {errors.organization && <div className="fyt-x-error">{errors.organization}</div>}
              </div>
              <div className="fyt-x-form-grid">
                <div className="fyt-x-field">
                  <label htmlFor="z-detail">{zone.detailLabel}</label>
                  <input id="z-detail" className="fyt-x-input" value={form.detail} onChange={set("detail")} placeholder={zone.detailPlaceholder} maxLength={100} />
                </div>
                <div className="fyt-x-field">
                  <label htmlFor="z-size">{zone.sizeLabel}</label>
                  <input id="z-size" className="fyt-x-input" type="number" min="1" max="5000" value={form.groupSize} onChange={set("groupSize")} />
                </div>
                <div className="fyt-x-field">
                  <label htmlFor="z-sport">Sport</label>
                  <select id="z-sport" className="fyt-x-select" value={form.sport} onChange={set("sport")}>
                    <option value="">Any / not sure</option>
                    {["Cricket", "Football", "Badminton", "Tennis", "Basketball", "Multiple"].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="fyt-x-field">
                  <label htmlFor="z-date">Preferred date</label>
                  <input id="z-date" className="fyt-x-input" type="date" min={new Date().toISOString().slice(0, 10)} value={form.preferredDate} onChange={set("preferredDate")} />
                </div>
              </div>
              <div className="fyt-x-field">
                <label htmlFor="z-email">Email <span className="fyt-x-muted">(optional)</span></label>
                <input id="z-email" className="fyt-x-input" type="email" value={form.email} onChange={set("email")} placeholder="name@example.com" maxLength={100} />
                {errors.email && <div className="fyt-x-error">{errors.email}</div>}
              </div>
              <div className="fyt-x-field">
                <label htmlFor="z-msg">Message <span className="fyt-x-muted">(optional)</span></label>
                <textarea id="z-msg" className="fyt-x-textarea" value={form.message} onChange={set("message")} placeholder={zone.messageHint} maxLength={500} />
              </div>
              <button className="fyt-btn-primary" type="submit" disabled={busy}>{busy ? "Sending…" : "Send request"}</button>
              <p className="fyt-x-muted">We'll use {identity.ready ? `+91 ${identity.phone}` : "your mobile number"} to reach you.</p>
            </form>
          )}
        </section>

        <section className="fyt-x-card fyt-x-stack">
          <h2 className="fyt-x-card-title">How it works</h2>
          <div className="fyt-x-steps">
            {zone.steps.map((s) => <div key={s} className="fyt-x-step">{s}</div>)}
          </div>
          {mine.length > 0 && (
            <>
              <hr className="fyt-x-divider" style={{ margin: "4px 0" }} />
              <h3 className="fyt-x-card-title" style={{ fontSize: 14 }}>Your requests</h3>
              {mine.map((m) => (
                <div key={m._id} className="fyt-x-row between">
                  <span className="fyt-x-sub">{m.organization} · {fmtDate(m.createdAt)}</span>
                  <span className={`fyt-x-badge ${STATUS_TONE[m.status] || ""}`}>{m.status}</span>
                </div>
              ))}
            </>
          )}
        </section>
      </div>
    </PageShell>
  );
}
