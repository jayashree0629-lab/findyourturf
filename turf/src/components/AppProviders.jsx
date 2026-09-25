import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, X, Phone, User } from "lucide-react";
import { getIdentity, saveProfile, getProfile } from "../services/profile";

const ToastContext = createContext(null);
const IdentityContext = createContext(null);

export const useToast = () => useContext(ToastContext);
export const useIdentity = () => useContext(IdentityContext);

const PHONE_RE = /^[6-9]\d{9}$/;

function IdentityModal({ reason, initial, onSave, onCancel }) {
  const [name, setName] = useState(initial.name || "");
  const [phone, setPhone] = useState(initial.phone || "");
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return setError("Please enter your name.");
    if (!PHONE_RE.test(phone)) return setError("Enter a valid 10-digit mobile number.");
    onSave({ name: name.trim(), phone });
  };

  return (
    <div className="fyt-x-overlay" role="presentation" onClick={onCancel}>
      <form
        className="fyt-x-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fyt-identity-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="fyt-x-modal-head">
          <div>
            <h2 id="fyt-identity-title">Quick details</h2>
            <p className="fyt-x-sub" style={{ marginTop: 4 }}>
              {reason || "We use your mobile number to recognise you. No OTP or password needed."}
            </p>
          </div>
          <button type="button" className="fyt-x-modal-close" onClick={onCancel} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="fyt-x-stack">
          <div className="fyt-x-field">
            <label htmlFor="fyt-id-name">Your name</label>
            <div className="fyt-input-with-icon">
              <User size={16} />
              <input
                id="fyt-id-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Karthik Raj"
                autoComplete="name"
                autoFocus={!name}
              />
            </div>
          </div>
          <div className="fyt-x-field">
            <label htmlFor="fyt-id-phone">Mobile number</label>
            <div className="fyt-input-with-icon">
              <Phone size={16} />
              <input
                id="fyt-id-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="10-digit mobile number"
                inputMode="numeric"
                autoComplete="tel-national"
                autoFocus={Boolean(name)}
              />
            </div>
          </div>
          {error && <div className="fyt-x-inline-msg error">{error}</div>}
        </div>
        <div className="fyt-x-modal-actions">
          <button type="button" className="fyt-btn-secondary" onClick={onCancel}>Not now</button>
          <button type="submit" className="fyt-btn-primary">Continue</button>
        </div>
      </form>
    </div>
  );
}

export function AppProviders({ children }) {
  // ---- Toasts ----
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (message, type = "success") => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-2), { id, message, type }]);
      setTimeout(() => dismiss(id), 3800);
    },
    [dismiss]
  );
  const toast = useMemo(
    () => ({
      success: (m) => push(m, "success"),
      error: (m) => push(m, "error"),
    }),
    [push]
  );

  // ---- Identity (name + mobile), asked for only when a feature needs it ----
  const [identity, setIdentity] = useState(() => getIdentity());
  const [prompt, setPrompt] = useState(null); // { reason, resolve }

  const requireIdentity = useCallback(
    (reason) => {
      const current = getIdentity();
      if (current.ready) {
        setIdentity(current);
        return Promise.resolve(current);
      }
      return new Promise((resolve) => setPrompt({ reason, resolve }));
    },
    []
  );

  const saveIdentity = ({ name, phone }) => {
    const existing = getProfile() || {};
    saveProfile({ ...existing, name, phone, email: existing.email || "" });
    window.dispatchEvent(new Event("storage"));
    const next = getIdentity();
    setIdentity(next);
    prompt?.resolve(next);
    setPrompt(null);
  };

  const cancelPrompt = () => {
    prompt?.resolve(null);
    setPrompt(null);
  };

  const identityValue = useMemo(
    () => ({
      identity,
      requireIdentity,
      refresh: () => setIdentity(getIdentity()),
    }),
    [identity, requireIdentity]
  );

  return (
    <ToastContext.Provider value={toast}>
      <IdentityContext.Provider value={identityValue}>
        {children}
        {prompt && (
          <IdentityModal
            reason={prompt.reason}
            initial={getIdentity()}
            onSave={saveIdentity}
            onCancel={cancelPrompt}
          />
        )}
        <div className="fyt-x-toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`fyt-x-toast ${t.type}`} role="status">
              {t.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
              <span>{t.message}</span>
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss" style={{ color: "#94A3B8" }}>
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      </IdentityContext.Provider>
    </ToastContext.Provider>
  );
}
