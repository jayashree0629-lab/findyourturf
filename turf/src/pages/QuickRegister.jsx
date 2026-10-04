import { useEffect, useRef, useState } from "react";
import { Phone, User, ArrowRight, CalendarCheck, Users, Ticket, ShieldCheck } from "lucide-react";
import { registerVisitor, loginVisitor, getAuthConfig, googleSignIn } from "../services/api";
import { saveVisitor } from "../services/profile";

const PHONE_RE = /^[6-9]\d{9}$/;
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.accounts) return resolve(window.google);
    const existing = document.getElementById("google-gsi");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google));
      existing.addEventListener("error", reject);
      return undefined;
    }
    const script = document.createElement("script");
    script.id = "google-gsi";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = reject;
    document.head.appendChild(script);
    return undefined;
  });
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

// First screen a new player sees: Google, or a name + mobile number.
// There is no password or OTP — the mobile number is what links a player to
// their bookings, rewards and coupons.
export default function QuickRegister({ onComplete }) {
  const [mode, setMode] = useState("signup"); // "signup" | "signin"
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null); // { type, text }
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [googleProfile, setGoogleProfile] = useState(null); // { credential, name, email, picture }
  const googleSlot = useRef(null);

  const finish = (visitor) => {
    saveVisitor({ visitorId: visitor.id, name: visitor.name, phone: visitor.phone });
    onComplete();
  };

  const explain = (err) =>
    err.isNetworkError || err.status === 0
      ? "We can't reach the server right now. Please check your connection and try again."
      : err.message || "Something went wrong. Please try again.";

  // Google button: only rendered when both the frontend and backend are set up.
  useEffect(() => {
    let cancelled = false;
    if (!GOOGLE_CLIENT_ID) return undefined;
    (async () => {
      const cfg = await getAuthConfig();
      if (!cfg.googleEnabled) return;
      try {
        const google = await loadGoogleScript();
        if (cancelled || !google || !googleSlot.current) return;
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response) => {
            setMessage(null);
            setLoading(true);
            try {
              const res = await googleSignIn(response.credential);
              if (res.visitor) return finish(res.visitor);
              setGoogleProfile({ credential: response.credential, ...res.profile });
              setName(res.profile.name || "");
            } catch (err) {
              setMessage({ type: "error", text: explain(err) });
            } finally {
              setLoading(false);
            }
            return undefined;
          },
        });
        google.accounts.id.renderButton(googleSlot.current, {
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          width: 360,
        });
        setGoogleReady(true);
      } catch {
        /* script blocked — the manual form still works */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validate = ({ needName }) => {
    const next = {};
    if (needName && !name.trim()) next.name = "Please enter your name.";
    if (!phone) next.phone = "Please enter your mobile number.";
    else if (!PHONE_RE.test(phone)) next.phone = "Enter a valid 10-digit mobile number.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    setMessage(null);
    const needName = mode === "signup" || Boolean(googleProfile);
    if (!validate({ needName })) return;

    setLoading(true);
    try {
      const visitor =
        mode === "signin" && !googleProfile
          ? await loginVisitor({ phone })
          : await registerVisitor({
              name: name.trim(),
              phone,
              googleCredential: googleProfile ? googleProfile.credential : undefined,
            });
      finish(visitor);
    } catch (err) {
      if (mode === "signin" && err.status === 404) {
        setMessage({ type: "info", text: err.message });
      } else {
        setMessage({ type: "error", text: explain(err) });
      }
    } finally {
      setLoading(false);
    }
  };

  const fallbackGoogle = () =>
    setMessage({
      type: "info",
      text: "Google sign-in isn't available just yet. Please continue with your name and mobile number — it only takes a moment.",
    });

  const switchMode = (next) => {
    setMode(next);
    setErrors({});
    setMessage(null);
  };

  const showGoogleStep = Boolean(googleProfile);

  return (
    <div className="ui-auth">
      <aside className="ui-auth-hero">
        <div className="ui-logo">
          <span className="ui-logo-mark">F</span>
          <span className="ui-logo-text">FindYour<b>Turf</b></span>
        </div>

        <div>
          <h1>Your game.<br />Your turf.<br />Your time.</h1>
          <p>Book sports turfs across Coimbatore, split the cost with your team, and follow live tournament scores.</p>
          <div className="ui-auth-points">
            <div className="ui-auth-point"><span className="i"><CalendarCheck size={17} /></span> See open slots and book in under a minute</div>
            <div className="ui-auth-point"><span className="i"><Users size={17} /></span> Split the payment with your teammates</div>
            <div className="ui-auth-point"><span className="i"><Ticket size={17} /></span> Manage bookings and earn reward points</div>
          </div>
        </div>

        <div className="ui-auth-foot">© {new Date().getFullYear()} FindYourTurf</div>
      </aside>

      <main className="ui-auth-side">
        <div className="ui-auth-card">
          <div className="ui-logo ui-auth-mobile-logo">
            <span className="ui-logo-mark">F</span>
            <span className="ui-logo-text">FindYour<b>Turf</b></span>
          </div>

          {showGoogleStep ? (
            <>
              <h2>Almost there</h2>
              <p className="sub">Add your mobile number to finish signing up. We use it to link your bookings and rewards.</p>
              <div className="ui-profile-chip">
                {googleProfile.picture ? <img src={googleProfile.picture} alt="" referrerPolicy="no-referrer" /> : null}
                <div><b>{googleProfile.name || "Google account"}</b><span>{googleProfile.email}</span></div>
              </div>
            </>
          ) : (
            <>
              <h2>{mode === "signup" ? "Create your account" : "Welcome back"}</h2>
              <p className="sub">
                {mode === "signup"
                  ? "Sign up to book turfs, join games and track your bookings."
                  : "Sign in with the mobile number you registered with."}
              </p>

              <div className="ui-tabs" role="tablist">
                <button role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={() => switchMode("signup")}>Sign up</button>
                <button role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? "active" : ""} onClick={() => switchMode("signin")}>Sign in</button>
              </div>

              <div className="ui-google-slot" ref={googleSlot} style={{ display: googleReady ? "flex" : "none" }} />
              {!googleReady && (
                <button type="button" className="ui-google" onClick={fallbackGoogle}>
                  <GoogleLogo /> Continue with Google
                </button>
              )}
              <div className="ui-or">or use your mobile number</div>
            </>
          )}

          {message && <div className={`ui-alert ${message.type}`} role={message.type === "error" ? "alert" : "status"}>{message.text}</div>}

          <form onSubmit={submit} noValidate>
            {(mode === "signup" || showGoogleStep) && (
              <div className="ui-field">
                <label htmlFor="auth-name">Full name</label>
                <div className="ui-input-wrap" style={{ maxWidth: "none" }}>
                  <User size={17} className="lead" />
                  <input
                    id="auth-name"
                    className="ui-input with-icon"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Karthik Raj"
                    autoComplete="name"
                    disabled={loading}
                  />
                </div>
                {errors.name && <div className="err">{errors.name}</div>}
              </div>
            )}

            <div className="ui-field">
              <label htmlFor="auth-phone">Mobile number</label>
              <div className="ui-phone">
                <span className="pre">+91</span>
                <input
                  id="auth-phone"
                  className="ui-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10-digit mobile number"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  disabled={loading}
                />
              </div>
              {errors.phone ? <div className="err">{errors.phone}</div> : <div className="hint"><Phone size={12} style={{ verticalAlign: "-1px" }} /> No password or OTP needed.</div>}
            </div>

            <button type="submit" className="ui-btn ui-btn-primary ui-btn-lg ui-btn-block" disabled={loading}>
              {loading ? "Please wait…" : showGoogleStep ? "Finish sign up" : mode === "signup" ? "Create account" : "Sign in"}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          {showGoogleStep && (
            <button className="ui-btn ui-btn-ghost ui-btn-block" style={{ marginTop: 10 }} onClick={() => setGoogleProfile(null)}>
              Use a different account
            </button>
          )}

          <p className="ui-auth-note">
            <ShieldCheck size={13} style={{ verticalAlign: "-2px", color: "#12A05C" }} /> Your details are only used for your bookings.
          </p>
        </div>
      </main>
    </div>
  );
}
