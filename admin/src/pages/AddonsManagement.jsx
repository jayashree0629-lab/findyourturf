import { useState, useEffect, useCallback, useMemo } from "react";
import { socket } from "../services/socket";
import Modal from "../components/common/Modal";
import { IconPlus, IconEdit, IconTrash, IconCheck, IconX, IconSparkles, IconSearch } from "../components/common/Icons";
import { SORT_OPTIONS, sortByName } from "../components/common/adminUi";
import {
  getAddons,
  createAddon,
  updateAddon,
  deleteAddon,
  getAddonBookings,
} from "../services/api";

const TABS = [
  { id: "photography", label: "Photographers" },
  { id: "videography", label: "Videographers" },
  { id: "coach", label: "Coaches" },
  { id: "equipment", label: "Equipment" },
];

const BLANK = {
  name: "",
  image: "",
  description: "",
  price: "",
  priceUnit: "",
  rating: "",
  durationLabel: "",
  packageDetails: "",
  sport: "",
  experienceYears: "",
  specialization: "",
  category: "",
  stock: "",
  unavailableDates: "",
  active: true,
};

function toForm(s) {
  return {
    name: s.name || "",
    image: s.image || "",
    description: s.description || "",
    price: s.price ?? "",
    priceUnit: s.priceUnit || "",
    rating: s.rating ?? "",
    durationLabel: s.durationLabel || "",
    packageDetails: s.packageDetails || "",
    sport: s.sport || "",
    experienceYears: s.experienceYears ?? "",
    specialization: s.specialization || "",
    category: s.category || "",
    stock: s.stock ?? "",
    unavailableDates: (s.unavailableDates || []).join(", "),
    active: s.active !== false,
  };
}

export default function AddonsManagement() {
  const [addons, setAddons] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("photography");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [form, setForm] = useState(BLANK);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("name_asc");

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [a, b] = await Promise.all([getAddons(), getAddonBookings().catch(() => [])]);
      setAddons(a);
      setBookings(b);
      setError("");
    } catch (err) {
      setError(err.message || "Unable to load add-ons.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const refresh = () => fetchAll();
    socket.on("addon:created", refresh);
    socket.on("addon:updated", refresh);
    socket.on("addon:deleted", refresh);
    socket.on("addon:booked", refresh);
    return () => {
      socket.off("addon:created", refresh);
      socket.off("addon:updated", refresh);
      socket.off("addon:deleted", refresh);
      socket.off("addon:booked", refresh);
    };
  }, [fetchAll]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = addons.filter((a) => {
      if (a.type !== tab) return false;
      if (!q) return true;
      return [a.name, a.description, a.sport, a.specialization, a.category, a.packageDetails]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
    return sortByName(list, sortBy);
  }, [addons, tab, query, sortBy]);
  const bookingCount = useCallback(
    (id) => bookings.filter((b) => String(b.service?._id || b.service) === String(id) && b.status !== "Cancelled").length,
    [bookings]
  );

  function openCreate() {
    setEditingId(null);
    setForm(BLANK);
    setError("");
    setIsOpen(true);
  }
  function openEdit(s) {
    setEditingId(s._id);
    setForm(toForm(s));
    setError("");
    setIsOpen(true);
  }

  const change = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  function payload() {
    const numOrNull = (v) => (v === "" || v === null ? null : Number(v));
    const p = {
      type: tab,
      name: form.name.trim(),
      image: form.image.trim(),
      description: form.description.trim(),
      price: numOrNull(form.price) ?? 0,
      priceUnit: form.priceUnit.trim(),
      rating: numOrNull(form.rating),
      unavailableDates: form.unavailableDates.split(",").map((s) => s.trim()).filter(Boolean),
      active: form.active,
    };
    if (tab === "photography" || tab === "videography") {
      p.durationLabel = form.durationLabel.trim();
      p.packageDetails = form.packageDetails.trim();
    }
    if (tab === "coach") {
      p.sport = form.sport.trim();
      p.experienceYears = numOrNull(form.experienceYears);
      p.specialization = form.specialization.trim();
      p.durationLabel = form.durationLabel.trim();
    }
    if (tab === "equipment") {
      p.category = form.category.trim();
      p.stock = numOrNull(form.stock) ?? 0;
    }
    return p;
  }

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || form.price === "") {
      setError("Name and price are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await updateAddon(editingId, payload());
        setNotice("Add-on updated.");
      } else {
        await createAddon(payload());
        setNotice("Add-on created.");
      }
      setIsOpen(false);
      setEditingId(null);
      await fetchAll();
    } catch (err) {
      setError(err.message || "Unable to save.");
    } finally {
      setSaving(false);
    }
  };

  async function toggleActive(s) {
    setBusyId(s._id);
    setError("");
    try {
      await updateAddon(s._id, { active: s.active === false });
      await fetchAll();
    } catch (err) {
      setError(err.message || "Unable to update.");
    } finally {
      setBusyId("");
    }
  }

  async function remove(s) {
    if (!window.confirm(`Delete "${s.name}"?`)) return;
    setBusyId(s._id);
    setError("");
    try {
      await deleteAddon(s._id);
      setNotice("Add-on deleted.");
      await fetchAll();
    } catch (err) {
      if (err.status === 409 && window.confirm(`${err.message}\n\nForce delete anyway?`)) {
        try {
          await deleteAddon(s._id, { force: true });
          await fetchAll();
        } catch (e2) {
          setError(e2.message);
        }
      } else if (err.status !== 409) {
        setError(err.message || "Unable to delete.");
      }
    } finally {
      setBusyId("");
    }
  }

  const isEquip = tab === "equipment";
  const isCoach = tab === "coach";
  const isMedia = tab === "photography" || tab === "videography";

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0 }}>Add-ons Management</h2>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
            Photography, videography, coaching &amp; equipment rentals. Prices &amp; stock configured here drive the checkout.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <IconPlus size={16} /> Add {TABS.find((t) => t.id === tab).label.replace(/s$/, "")}
        </button>
      </div>

      <div className="filter-pills-group" style={{ marginBottom: 16 }}>
        {TABS.map((t) => (
          <button key={t.id} className={`filter-pill ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label} ({addons.filter((a) => a.type === t.id).length})
          </button>
        ))}
      </div>

      <div className="toolbar">
        <div className="toolbar-search">
          <span><IconSearch size={15} /></span>
          <input className="form-control" placeholder="Search by name, sport or details" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search add-ons" />
        </div>
        <select className="form-control" value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort add-ons">
          {SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>

      {error && <div className="alert-banner error" style={{ marginBottom: 12 }}>{error}</div>}
      {notice && !error && (
        <div className="alert-banner" style={{ marginBottom: 12, background: "#ecfdf5", color: "#047857" }}>{notice}</div>
      )}

      <div className="card">
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#666" }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#666" }}>
            <IconSparkles size={38} style={{ opacity: 0.4 }} />
            <h3>No {TABS.find((t) => t.id === tab).label.toLowerCase()} yet</h3>
            <p>Add one to make it bookable at checkout.</p>
          </div>
        ) : (
          <div className="matches-grid" style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {rows.map((s) => {
              const active = s.active !== false;
              return (
                <div key={s._id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, opacity: busyId === s._id ? 0.5 : 1, background: active ? "#fff" : "#f8fafc" }}>
                  <div style={{ display: "flex", gap: 10 }}>
                    {s.image ? (
                      <img src={s.image} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", flex: "0 0 auto" }} />
                    ) : null}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                        <h4 style={{ margin: 0 }}>{s.name}</h4>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: active ? "#dcfce7" : "#fee2e2", color: active ? "#166534" : "#991b1b", whiteSpace: "nowrap" }}>
                          {active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div style={{ fontSize: 12.5, color: "#334155", marginTop: 6, display: "grid", gap: 2 }}>
                        <span><strong>₹{s.price}</strong>{s.priceUnit ? ` / ${s.priceUnit}` : ""}</span>
                        {isCoach && <span>Sport: {s.sport || "—"} · {s.experienceYears != null ? `${s.experienceYears} yrs` : "exp —"}</span>}
                        {isCoach && s.specialization && <span>Focus: {s.specialization}</span>}
                        {isMedia && s.durationLabel && <span>Duration: {s.durationLabel}</span>}
                        {isMedia && s.packageDetails && <span style={{ color: "#64748b" }}>{s.packageDetails}</span>}
                        {isEquip && <span>Category: {s.category || "—"} · Stock: <strong>{s.stock}</strong></span>}
                        {s.rating != null && <span>Rating: {s.rating} ★</span>}
                        {(s.unavailableDates || []).length > 0 && (
                          <span style={{ color: "#b45309" }}>Blackout: {s.unavailableDates.join(", ")}</span>
                        )}
                        <span style={{ color: "#64748b" }}>{bookingCount(s._id)} active booking(s)</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                    <button className="btn btn-outline btn-sm" disabled={busyId === s._id} onClick={() => openEdit(s)}>
                      <IconEdit size={13} /> Edit
                    </button>
                    <button className="btn btn-outline btn-sm" disabled={busyId === s._id} onClick={() => toggleActive(s)}>
                      {active ? <><IconX size={13} /> Deactivate</> : <><IconCheck size={13} /> Activate</>}
                    </button>
                    <button className="btn btn-outline-danger btn-sm" disabled={busyId === s._id} onClick={() => remove(s)}>
                      <IconTrash size={13} /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={`${editingId ? "Edit" : "Add"} ${TABS.find((t) => t.id === tab).label.replace(/s$/, "")}`} maxWidth="680px">
        <form onSubmit={submit} className="admin-form">
          {error && <div className="alert-banner error" style={{ marginBottom: 12 }}>{error}</div>}

          <div className="form-group">
            <label>Name *</label>
            <input name="name" value={form.name} onChange={change} required className="form-control" />
          </div>

          <div className="form-row" style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Price (₹) *</label>
              <input type="number" min="0" name="price" value={form.price} onChange={change} required className="form-control" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Price unit <span style={{ color: "#94a3b8" }}>(e.g. 2 hours / match / session)</span></label>
              <input name="priceUnit" value={form.priceUnit} onChange={change} className="form-control" />
            </div>
          </div>

          <div className="form-group">
            <label>Image URL</label>
            <input name="image" value={form.image} onChange={change} className="form-control" placeholder="https://…" />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea name="description" value={form.description} onChange={change} rows={2} className="form-control" />
          </div>

          {isMedia && (
            <div className="form-row" style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Duration label</label>
                <input name="durationLabel" value={form.durationLabel} onChange={change} className="form-control" placeholder="2 hours / Full match" />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Package details</label>
                <input name="packageDetails" value={form.packageDetails} onChange={change} className="form-control" />
              </div>
            </div>
          )}

          {isCoach && (
            <>
              <div className="form-row" style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Sport</label>
                  <input name="sport" value={form.sport} onChange={change} className="form-control" placeholder="Cricket / Football / Badminton" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Experience (years)</label>
                  <input type="number" min="0" name="experienceYears" value={form.experienceYears} onChange={change} className="form-control" />
                </div>
              </div>
              <div className="form-row" style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Specialization</label>
                  <input name="specialization" value={form.specialization} onChange={change} className="form-control" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Session duration</label>
                  <input name="durationLabel" value={form.durationLabel} onChange={change} className="form-control" placeholder="1 hour session" />
                </div>
              </div>
            </>
          )}

          {isEquip && (
            <div className="form-row" style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Category</label>
                <input name="category" value={form.category} onChange={change} className="form-control" placeholder="Cricket / Football" />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Stock (units available) *</label>
                <input type="number" min="0" name="stock" value={form.stock} onChange={change} className="form-control" />
              </div>
            </div>
          )}

          <div className="form-row" style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Rating <span style={{ color: "#94a3b8" }}>(0–5, blank if none)</span></label>
              <input type="number" min="0" max="5" step="0.1" name="rating" value={form.rating} onChange={change} className="form-control" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Blackout dates <span style={{ color: "#94a3b8" }}>(YYYY-MM-DD, comma sep.)</span></label>
              <input name="unavailableDates" value={form.unavailableDates} onChange={change} className="form-control" placeholder="2026-10-02, 2026-10-05" />
            </div>
          </div>

          <div className="form-group">
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" name="active" checked={form.active} onChange={change} /> Active (bookable)
            </label>
          </div>

          <div className="form-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button type="button" className="btn btn-outline" onClick={() => setIsOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save Changes" : "Create"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
