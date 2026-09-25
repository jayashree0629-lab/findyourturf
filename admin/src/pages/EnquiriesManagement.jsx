import { useState, useEffect, useCallback, useMemo } from "react";
import Modal from "../components/common/Modal";
import { socket } from "../services/socket";
import { IconBell } from "../components/common/Icons";
import {
  getZoneEnquiries,
  updateZoneEnquiry,
  approveZoneEnquiry,
  deleteZoneEnquiry,
} from "../services/api";
import {
  useFlash,
  FlashBanner,
  PageHeader,
  Pill,
  EmptyBox,
  ConfirmModal,
  formatDate,
} from "../components/common/adminUi";

const ZONE_FILTERS = [
  { id: "all", label: "All" },
  { id: "student", label: "Student Zone" },
  { id: "corporate", label: "Corporate Zone" },
];
const STATUS_FILTERS = ["Open", "New", "In Review", "Approved", "Rejected", "Closed", "All"];
const TONE = { New: "blue", "In Review": "amber", Approved: "green", Rejected: "red", Closed: "slate" };

export default function EnquiriesManagement() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zone, setZone] = useState("all");
  const [status, setStatus] = useState("Open");
  const [flash, setFlash] = useFlash();
  const [approve, setApprove] = useState(null); // { enquiry, form }
  const [note, setNote] = useState(null); // { enquiry, status, text }
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await getZoneEnquiries());
    } catch (err) {
      setFlash("error", err.message || "Couldn't load requests.");
    } finally {
      setLoading(false);
    }
  }, [setFlash]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    socket.on("zones:changed", load);
    return () => socket.off("zones:changed", load);
  }, [load]);

  const rows = useMemo(
    () =>
      items.filter((e) => {
        if (zone !== "all" && e.zone !== zone) return false;
        if (status === "Open") return e.status === "New" || e.status === "In Review";
        return status === "All" || e.status === status;
      }),
    [items, zone, status]
  );

  const openCount = items.filter((e) => e.status === "New" || e.status === "In Review").length;

  const openApprove = (enquiry) =>
    setApprove({
      enquiry,
      form: {
        giveDiscount: true,
        type: "PERCENT",
        value: enquiry.zone === "student" ? "15" : "10",
        maxDiscount: "200",
        minOrder: "",
        validDays: "60",
        maxUses: "5",
        adminNote: "",
      },
    });

  const setF = (k) => (e) =>
    setApprove((a) => ({ ...a, form: { ...a.form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value } }));

  const submitApprove = async (e) => {
    e.preventDefault();
    const f = approve.form;
    setBusy(true);
    try {
      const res = await approveZoneEnquiry(approve.enquiry._id, {
        type: f.type,
        value: f.giveDiscount ? Number(f.value) : 0,
        maxDiscount: Number(f.maxDiscount) || 0,
        minOrder: Number(f.minOrder) || 0,
        validDays: Number(f.validDays) || 60,
        maxUses: Number(f.maxUses) || 5,
        adminNote: f.adminNote,
      });
      setFlash(
        "success",
        res.couponCode
          ? `Approved. Coupon ${res.couponCode} is now visible to ${res.name} on the site.`
          : `Approved ${res.name}.`
      );
      setApprove(null);
      await load();
    } catch (err) {
      setFlash("error", err.message);
    } finally {
      setBusy(false);
    }
  };

  const quickStatus = async (enquiry, newStatus, adminNote) => {
    setBusy(true);
    try {
      await updateZoneEnquiry(enquiry._id, { status: newStatus, ...(adminNote !== undefined ? { adminNote } : {}) });
      setFlash("success", `${enquiry.name} marked ${newStatus}.`);
      setNote(null);
      await load();
    } catch (err) {
      setFlash("error", err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteZoneEnquiry(toDelete._id);
      setFlash("success", "Request deleted.");
      setToDelete(null);
      await load();
    } catch (err) {
      setFlash("error", err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <PageHeader
        title="Zone Requests"
        subtitle="Student and Corporate zone requests from the public site. Approve a request to issue the player a personal discount coupon."
      />

      <FlashBanner flash={flash} onDismiss={() => setFlash(null)} />

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
        <div className="filter-pills-group">
          {ZONE_FILTERS.map((z) => (
            <button key={z.id} className={`filter-pill ${zone === z.id ? "active" : ""}`} onClick={() => setZone(z.id)}>
              {z.label}
            </button>
          ))}
        </div>
        <div className="filter-pills-group">
          {STATUS_FILTERS.map((s) => (
            <button key={s} className={`filter-pill ${status === s ? "active" : ""}`} onClick={() => setStatus(s)}>
              {s === "Open" ? `Needs action (${openCount})` : s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "#666" }}>Loading requests…</div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyBox icon={IconBell} title="Nothing to review" text="New Student and Corporate requests will appear here." />
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}>
          {rows.map((e) => (
            <div key={e._id} className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{e.name}</div>
                  <a href={`tel:+91${e.phone}`} style={{ color: "#2563eb", fontSize: 13, fontWeight: 600 }}>
                    +91 {e.phone}
                  </a>
                  {e.email && <div style={{ fontSize: 12, color: "#64748b" }}>{e.email}</div>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                  <Pill tone={TONE[e.status]}>{e.status}</Pill>
                  <Pill tone={e.zone === "student" ? "blue" : "slate"}>{e.zone === "student" ? "Student" : "Corporate"}</Pill>
                </div>
              </div>

              <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.6 }}>
                <div><strong>{e.organization}</strong>{e.detail ? ` · ${e.detail}` : ""}</div>
                <div>
                  {e.groupSize} {e.zone === "student" ? "in team" : "people"}
                  {e.sport ? ` · ${e.sport}` : ""}
                  {e.preferredDate ? ` · wants ${formatDate(e.preferredDate, { utc: true })}` : ""}
                </div>
                {e.message && <div style={{ color: "#64748b", marginTop: 4 }}>“{e.message}”</div>}
                {e.couponCode && (
                  <div style={{ marginTop: 4 }}>
                    Coupon: <code style={{ fontWeight: 800 }}>{e.couponCode}</code>
                  </div>
                )}
                {e.adminNote && <div style={{ color: "#64748b" }}>Note: {e.adminNote}</div>}
              </div>

              <div style={{ fontSize: 11, color: "#94a3b8" }}>Received {formatDate(e.createdAt, { time: true })}</div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: "auto" }}>
                {(e.status === "New" || e.status === "In Review") && (
                  <>
                    <button className="btn btn-primary btn-sm" onClick={() => openApprove(e)}>Approve</button>
                    {e.status === "New" && (
                      <button className="btn btn-secondary btn-sm" onClick={() => quickStatus(e, "In Review")} disabled={busy}>
                        Start review
                      </button>
                    )}
                    <button className="btn btn-outline-danger btn-sm" onClick={() => setNote({ enquiry: e, status: "Rejected", text: "" })}>
                      Reject
                    </button>
                  </>
                )}
                {e.status === "Approved" && (
                  <button className="btn btn-secondary btn-sm" onClick={() => quickStatus(e, "Closed")} disabled={busy}>Close</button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => setToDelete(e)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={Boolean(approve)} onClose={() => setApprove(null)} title={approve ? `Approve ${approve.enquiry.name}` : ""} maxWidth="520px">
        {approve && (
          <form onSubmit={submitApprove}>
            <div className="modal-body">
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 600, marginBottom: 12 }}>
                <input type="checkbox" checked={approve.form.giveDiscount} onChange={setF("giveDiscount")} />
                Issue a personal discount coupon
              </label>
              {approve.form.giveDiscount && (
                <div className="form-grid">
                  <div className="form-group col-4">
                    <label className="form-label">Type</label>
                    <select className="form-control" value={approve.form.type} onChange={setF("type")}>
                      <option value="PERCENT">Percent off</option>
                      <option value="FLAT">Flat ₹ off</option>
                    </select>
                  </div>
                  <div className="form-group col-4">
                    <label className="form-label">{approve.form.type === "PERCENT" ? "Percent" : "Amount (₹)"}</label>
                    <input className="form-control" type="number" min="1" max={approve.form.type === "PERCENT" ? 100 : undefined} value={approve.form.value} onChange={setF("value")} required />
                  </div>
                  <div className="form-group col-4">
                    <label className="form-label">Max discount (₹)</label>
                    <input className="form-control" type="number" min="0" value={approve.form.maxDiscount} onChange={setF("maxDiscount")} disabled={approve.form.type !== "PERCENT"} />
                  </div>
                  <div className="form-group col-4">
                    <label className="form-label">Min booking (₹)</label>
                    <input className="form-control" type="number" min="0" value={approve.form.minOrder} onChange={setF("minOrder")} placeholder="None" />
                  </div>
                  <div className="form-group col-4">
                    <label className="form-label">Valid for (days)</label>
                    <input className="form-control" type="number" min="1" max="365" value={approve.form.validDays} onChange={setF("validDays")} />
                  </div>
                  <div className="form-group col-4">
                    <label className="form-label">Number of bookings</label>
                    <input className="form-control" type="number" min="1" max="50" value={approve.form.maxUses} onChange={setF("maxUses")} />
                  </div>
                </div>
              )}
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">Note to the player (optional)</label>
                <textarea className="form-control" rows={2} value={approve.form.adminNote} onChange={setF("adminNote")} maxLength={500} placeholder="e.g. Valid on weekday bookings before 5 PM." />
              </div>
              <p style={{ margin: "10px 0 0", fontSize: 12, color: "#64748b" }}>
                The coupon is tied to {approve.enquiry.phone} and appears on their Zone page and at checkout.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setApprove(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Approving…" : "Approve"}</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={Boolean(note)} onClose={() => setNote(null)} title={note ? `Reject ${note.enquiry.name}?` : ""} maxWidth="440px">
        {note && (
          <>
            <div className="modal-body">
              <label className="form-label">Reason shown to the player (optional)</label>
              <textarea className="form-control" rows={3} value={note.text} onChange={(ev) => setNote((n) => ({ ...n, text: ev.target.value }))} maxLength={500} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setNote(null)}>Go back</button>
              <button className="btn btn-coral" onClick={() => quickStatus(note.enquiry, "Rejected", note.text)} disabled={busy}>Reject request</button>
            </div>
          </>
        )}
      </Modal>

      <ConfirmModal
        isOpen={Boolean(toDelete)}
        danger
        busy={busy}
        title="Delete this request?"
        message="It will be removed permanently. Any coupon already issued keeps working."
        confirmLabel="Delete"
        onConfirm={remove}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
