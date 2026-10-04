import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { GraduationCap, Building2, BadgePercent, CalendarClock, Users, Trophy, Copy, CheckCircle2, Clock, IdCard, X } from "lucide-react";
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

// Shrinks a photo of an ID card to a small JPEG (about 100-250 KB) in the
// browser before it is uploaded, so phone camera photos don't hit size limits.
function compressImage(file, maxSide = 1280, quality = 0.78) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      reject(new Error("Please choose a JPG, PNG or WebP photo."));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const out = canvas.toDataURL("image/jpeg", quality);
      if (out.length > 800000) reject(new Error("That photo is too large. Try a smaller or clearer photo."));
      else resolve(out);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("We couldn't read that photo. Please try another."));
    };
    img.src = url;
  });
}

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
  const [idNumber, setIdNumber] = useState("");
  const [idProof, setIdProof] = useState("");
  const fileRef = useRef(null);

  const pickFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      setIdProof(await compressImage(file));
      setErrors((prev) => ({ ...prev, idProof: undefined }));
    } catch (err) {
      setErrors((prev) => ({ ...prev, idProof: err.message }));
    }
  };

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
    if (zoneParam === "student" && !idProof) next.idProof = "Please upload a photo of your college ID card.";
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
        ...(zoneParam === "student" ? { idNumber: idNumber.trim(), idProofImage: idProof } : {}),
      });
      toast.success("Request sent! We'll be in touch soon.");
      setForm({ organization: "", detail: "", groupSize: 1, sport: "", preferredDate: "", email: "", message: "" });
      setIdNumber("");
      setIdProof("");
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
              {zoneParam === "student" && (
                <div className="fyt-x-stack" style={{ gap: 10 }}>
                  <div className="fyt-x-field">
                    <label htmlFor="z-idno">College ID number <span className="fyt-x-muted">(optional)</span></label>
                    <input id="z-idno" className="fyt-x-input" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="e.g. 21CS045" maxLength={40} />
                  </div>
                  <div className="fyt-x-field">
                    <label>College ID card photo *</label>
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={pickFile} hidden />
                    {idProof ? (
                      <div className="ui-upload-preview">
                        <img src={idProof} alt="Your college ID card" />
                        <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" style={{ marginTop: 8 }} onClick={() => setIdProof("")}>
                          <X size={14} /> Remove and choose another
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="ui-upload" onClick={() => fileRef.current && fileRef.current.click()}>
                        <span className="ico"><IdCard size={22} /></span>
                        <span><b>Upload or take a photo</b><span className="d">Front of your college ID. Make sure your name and photo are clear.</span></span>
                      </button>
                    )}
                    {errors.idProof && <div className="fyt-x-error">{errors.idProof}</div>}
                    <small>Only our team can see your ID, and it is used just to verify you are a student.</small>
                  </div>
                </div>
              )}
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
