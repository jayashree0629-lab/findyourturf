import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "./Modal";

// A transient success/error banner that clears itself.
export function useFlash() {
  const [flash, setFlashState] = useState(null);
  const timer = useRef(null);

  const setFlash = useCallback((type, message) => {
    clearTimeout(timer.current);
    setFlashState(message ? { type, message } : null);
    if (message) timer.current = setTimeout(() => setFlashState(null), 5000);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);
  return [flash, setFlash];
}

export function FlashBanner({ flash, onDismiss }) {
  if (!flash) return null;
  return (
    <div
      className={`alert-banner ${flash.type === "error" ? "error" : ""}`}
      style={
        flash.type === "error"
          ? { marginBottom: 12 }
          : { marginBottom: 12, background: "#ecfdf5", color: "#047857" }
      }
      role={flash.type === "error" ? "alert" : "status"}
    >
      <span>{flash.message}</span>
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        flexWrap: "wrap",
        gap: 12,
        marginBottom: 16,
      }}
    >
      <div>
        <h2 style={{ margin: 0 }}>{title}</h2>
        {subtitle && <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13, maxWidth: 640 }}>{subtitle}</p>}
      </div>
      {children && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{children}</div>}
    </div>
  );
}

const TONES = {
  green: { background: "#ecfdf5", color: "#047857", borderColor: "#a7f3d0" },
  amber: { background: "#fffbeb", color: "#b45309", borderColor: "#fde68a" },
  red: { background: "#fef2f2", color: "#b91c1c", borderColor: "#fecaca" },
  blue: { background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" },
  slate: { background: "#f1f5f9", color: "#475569", borderColor: "#e2e8f0" },
};

export function Pill({ tone = "slate", children }) {
  return (
    <span
      style={{
        ...TONES[tone],
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        border: "1px solid",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function EmptyBox({ icon: Icon, title, text }) {
  return (
    <div style={{ padding: 40, textAlign: "center", color: "#666" }}>
      {Icon && (
        <span style={{ opacity: 0.4, display: "inline-flex" }}>
          <Icon size={38} />
        </span>
      )}
      <h3 style={{ margin: "8px 0 4px" }}>{title}</h3>
      {text && <p style={{ margin: 0 }}>{text}</p>}
    </div>
  );
}

export function ConfirmModal({ isOpen, title, message, confirmLabel = "Confirm", danger = false, busy = false, onConfirm, onClose }) {
  return (
    <Modal isOpen={isOpen} onClose={busy ? () => {} : onClose} title={title} maxWidth="440px">
      <div className="modal-body">
        <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>{message}</p>
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
          Go back
        </button>
        <button className={`btn ${danger ? "btn-coral" : "btn-primary"}`} onClick={onConfirm} disabled={busy}>
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

// `utc: true` is for booking/play dates, which are stored as a calendar day at
// UTC midnight; everything else (created-at etc.) shows in local time.
export function formatDate(value, { time = false, utc = false } = {}) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(time ? { hour: "numeric", minute: "2-digit" } : {}),
    ...(utc ? { timeZone: "UTC" } : {}),
  });
}

export function money(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}
