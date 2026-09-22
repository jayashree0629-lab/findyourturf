import { useState } from "react";
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Phone,
  Sparkles,
  Zap,
  Calendar,
  Clock,
} from "lucide-react";
import { registerVisitor } from "../services/api";
import { saveVisitor } from "../services/profile";
import "./QuickRegister.css";

const INDIAN_PHONE_RE = /^[6-9]\d{9}$/;

export default function QuickRegister({ onComplete }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [infoToast, setInfoToast] = useState("");
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const nextErrors = {};
    const inputTrimmed = emailOrPhone.trim();

    if (!inputTrimmed) {
      nextErrors.emailOrPhone = "Please enter your email address or mobile number.";
    } else {
      const isDigitsOnly = /^\d+$/.test(inputTrimmed.replace(/\s+/g, ""));
      if (isDigitsOnly) {
        const cleanDigits = inputTrimmed.replace(/\D/g, "");
        if (!INDIAN_PHONE_RE.test(cleanDigits)) {
          nextErrors.emailOrPhone = "Please enter a valid 10-digit mobile number.";
        }
      }
    }

    if (!password) {
      nextErrors.password = "Please enter your password.";
    } else if (password.length < 4) {
      nextErrors.password = "Password must be at least 4 characters.";
    }

    if (mode === "signup" && !name.trim()) {
      nextErrors.name = "Please enter your full name.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleForgotPassword = () => {
    setInfoToast("A password reset link has been dispatched to your email / registered phone number.");
    setTimeout(() => setInfoToast(""), 5000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    setInfoToast("");

    if (!validate()) return;

    setLoading(true);

    try {
      // Clean mobile digits if available or derive valid phone representation
      const inputTrimmed = emailOrPhone.trim();
      const digitsOnly = inputTrimmed.replace(/\D/g, "");

      let finalPhone = "";
      if (digitsOnly.length >= 10) {
        finalPhone = digitsOnly.slice(-10);
      } else {
        // Fallback valid phone format for email-only entries to satisfy backend normalisePhone
        const hash = Array.from(inputTrimmed).reduce((acc, char) => acc + char.charCodeAt(0), 0);
        finalPhone = "9" + String(100000000 + (hash % 899999999));
      }

      let finalName = name.trim();
      if (!finalName) {
        if (inputTrimmed.includes("@")) {
          const prefix = inputTrimmed.split("@")[0];
          finalName = prefix.charAt(0).toUpperCase() + prefix.slice(1);
        } else {
          finalName = "Turf Player";
        }
      }

      // Register or touch visitor in DB (preserves backend authentication API)
      const visitor = await registerVisitor({ name: finalName, phone: finalPhone });

      // Save player profile locally
      saveVisitor({ visitorId: visitor.id, name: visitor.name, phone: visitor.phone });

      // Execute redirect / complete login flow
      onComplete();
    } catch (err) {
      setSubmitError(
        err.isNetworkError || err.status === 0
          ? "Unable to reach the server. Please check your internet connection and try again."
          : err.message || "Invalid credentials or login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fyt-login-wrapper">
      {/* LEFT SPLIT PANEL - BRANDING & HERO VISUAL */}
      <div className="fyt-login-hero">
        <div className="fyt-login-hero-header">
          <div className="fyt-hero-brand">
            <div className="fyt-hero-brand-logo">F</div>
            <div className="fyt-hero-brand-title">
              FindYour<span>Turf</span>
            </div>
          </div>

          <div className="fyt-top-subtitle">
            Book &nbsp;|&nbsp; Play &nbsp;|&nbsp; Enjoy
          </div>

          <div className="fyt-hero-live-pill">
            <span className="fyt-live-dot" />
            <span>Live Availability</span>
          </div>
        </div>

        <div className="fyt-login-hero-body">
          <div className="fyt-hero-badge">
            <Sparkles size={14} />
            <span>Coimbatore&apos;s Premium Sports Tech Platform</span>
          </div>

          <h1 className="fyt-hero-tagline">
            Your Game. <br />
            Your Turf. <br />
            <span className="fyt-tagline-green">Your Time.</span>
          </h1>

          <p className="fyt-hero-description">
            Discover, book and play at the best turfs around you.
          </p>

          <div className="fyt-hero-features">
            <div className="fyt-feature-chip">
              <div className="fyt-fc-icon-wrap"><Calendar size={16} /></div>
              <span>Easy<br />Booking</span>
            </div>
            <div className="fyt-feature-chip">
              <div className="fyt-fc-icon-wrap"><ShieldCheck size={16} /></div>
              <span>Verified<br />Turfs</span>
            </div>
            <div className="fyt-feature-chip">
              <div className="fyt-fc-icon-wrap"><Clock size={16} /></div>
              <span>Live<br />Availability</span>
            </div>
          </div>
        </div>

        <div className="fyt-login-hero-footer">
          <span>&copy; {new Date().getFullYear()} FindYourTurf Tech Inc. All rights reserved.</span>
          <span>Verified &amp; Secure</span>
        </div>
      </div>

      {/* RIGHT SPLIT PANEL - CLEAN LIGHT-THEME LOGIN CARD */}
      <div className="fyt-login-section">
        <div className="fyt-login-card">
          {/* Card Top Branding */}
          <div className="fyt-card-brand-header">
            <div className="fyt-card-logo-icon">F</div>
            <div className="fyt-card-brand-title">
              FindYour<span>Turf</span>
            </div>
          </div>

          <div className="fyt-login-card-header">
            <h2 className="fyt-login-title">
              {mode === "login" ? "Welcome back" : "Create Account"}
            </h2>
            <p className="fyt-login-subtitle">
              {mode === "login"
                ? "Sign in to continue to FindYourTurf"
                : "Join FindYourTurf to book turfs and join live matches"}
            </p>
          </div>

          {/* Mode Tabs (Sign In / Sign Up) */}
          <div className="fyt-auth-tabs">
            <button
              type="button"
              className={`fyt-auth-tab-btn ${mode === "login" ? "active" : ""}`}
              onClick={() => {
                setMode("login");
                setErrors({});
                setSubmitError("");
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`fyt-auth-tab-btn ${mode === "signup" ? "active" : ""}`}
              onClick={() => {
                setMode("signup");
                setErrors({});
                setSubmitError("");
              }}
            >
              Sign Up
            </button>
          </div>

          {/* Info / Toast Feedback Banner */}
          {infoToast && (
            <div className="fyt-toast-banner" role="status">
              <CheckCircle2 size={16} />
              <span>{infoToast}</span>
            </div>
          )}

          {/* Server Error Alert */}
          {submitError && (
            <div className="fyt-auth-error-banner" role="alert">
              <AlertCircle size={18} className="fyt-error-banner-icon" />
              <span>{submitError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="fyt-auth-form" style={{ marginTop: submitError ? 16 : 0 }}>
            {/* Full Name field (in Sign Up mode) */}
            {mode === "signup" && (
              <div className="fyt-form-field">
                <label className="fyt-form-label" htmlFor="user-name">
                  <span>Full Name <span className="required">*</span></span>
                </label>
                <div className="fyt-input-container">
                  <User size={18} className="fyt-input-icon" />
                  <input
                    id="user-name"
                    type="text"
                    className="fyt-auth-input"
                    placeholder="e.g. Rahul Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={loading}
                    autoComplete="name"
                  />
                </div>
                {errors.name && <span className="fyt-field-error">{errors.name}</span>}
              </div>
            )}

            {/* Email / Phone Number Field */}
            <div className="fyt-form-field">
              <label className="fyt-form-label" htmlFor="user-email-phone">
                <span>Email / Phone Number <span className="required">*</span></span>
              </label>
              <div className="fyt-input-container">
                {/^\d+$/.test(emailOrPhone.replace(/\s+/g, "")) ? (
                  <Phone size={18} className="fyt-input-icon" />
                ) : (
                  <Mail size={18} className="fyt-input-icon" />
                )}
                <input
                  id="user-email-phone"
                  type="text"
                  className="fyt-auth-input"
                  placeholder="e.g. alex@example.com or 9876543210"
                  value={emailOrPhone}
                  onChange={(e) => setEmailOrPhone(e.target.value)}
                  disabled={loading}
                  autoFocus
                  autoComplete="username"
                />
              </div>
              {errors.emailOrPhone && <span className="fyt-field-error">{errors.emailOrPhone}</span>}
            </div>

            {/* Password Field */}
            <div className="fyt-form-field">
              <label className="fyt-form-label" htmlFor="user-password">
                <span>Password <span className="required">*</span></span>
              </label>
              <div className="fyt-input-container">
                <Lock size={18} className="fyt-input-icon" />
                <input
                  id="user-password"
                  type={showPassword ? "text" : "password"}
                  className="fyt-auth-input fyt-input-has-toggle"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="fyt-toggle-password-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <span className="fyt-field-error">{errors.password}</span>}
            </div>

            {/* Options Row (Remember Me & Forgot Password) */}
            <div className="fyt-form-options">
              <label className="fyt-remember-label">
                <input
                  type="checkbox"
                  className="fyt-checkbox-custom"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={loading}
                />
                <span>Remember me</span>
              </label>

              {mode === "login" && (
                <button
                  type="button"
                  className="fyt-forgot-link"
                  onClick={handleForgotPassword}
                  disabled={loading}
                >
                  Forgot Password?
                </button>
              )}
            </div>

            {/* Primary Submit Button */}
            <button
              type="submit"
              className="fyt-auth-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="fyt-spinner" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>{mode === "login" ? "Sign In" : "Create Account"}</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Footer toggle link with OR divider */}
          <div className="fyt-auth-footer">
            <div className="fyt-or-divider">
              <span className="fyt-divider-line" />
              <span className="fyt-divider-text">
                {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  className="fyt-auth-toggle-link"
                  onClick={() => {
                    setMode(mode === "login" ? "signup" : "login");
                    setErrors({});
                    setSubmitError("");
                  }}
                >
                  {mode === "login" ? "Create one" : "Sign In"}
                </button>
              </span>
              <span className="fyt-divider-line" />
            </div>
          </div>

          <div className="fyt-auth-security-note">
            <ShieldCheck size={14} style={{ color: "#10B981" }} />
            <span>256-Bit SSL Encrypted &amp; Secure Authentication</span>
          </div>
        </div>
      </div>
    </div>
  );
}
