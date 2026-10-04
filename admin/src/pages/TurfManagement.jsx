import { useState, useEffect, useCallback, useMemo } from "react";
import { socket } from "../services/socket";
import Modal from "../components/common/Modal";
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconMapPin,
  IconClock,
  IconCheck,
  IconX,
  IconSearch,
  IconPhone,
} from "../components/common/Icons";
import {
  getTurfs,
  createTurf,
  updateTurf,
  deleteTurf,
  getTurfOwners,
  saveTurfOwner,
  removeTurfOwner,
  regenerateOwnerLink,
} from "../services/api";
import { PageIntro, SORT_OPTIONS, sortByName } from "../components/common/adminUi";

const ROOF_TYPES = ["Not verified", "Open", "Closed", "Partial"];

const BLANK_FORM = {
  name: "",
  location: "",
  address: "",
  sports: "",
  pricePerHour: "",
  floodlightChargePerHour: "",
  roofType: "Not verified",
  openingTime: "",
  closingTime: "",
  slotDurationMinutes: 60,
  contactNumber: "",
  facilities: "",
  latitude: "",
  longitude: "",
  weatherLocation: "",
  description: "",
  status: "Active",
};

const BLANK_OWNER = { name: "", phone: "", email: "" };

function portalUrl(token) {
  return `${window.location.origin}/owner/${token}`;
}

function money(v) {
  return v === null || v === undefined || v === "" ? "Not verified" : `₹${v}`;
}

function hours(t) {
  if (!t.openingTime && !t.closingTime) return "Not verified";
  return `${t.openingTime || "—"} – ${t.closingTime || "—"}`;
}

function toForm(turf) {
  return {
    name: turf.name || "",
    location: turf.location || "",
    address: turf.address || "",
    sports: (turf.sports || []).join(", "),
    pricePerHour: turf.pricePerHour ?? "",
    floodlightChargePerHour: turf.floodlightChargePerHour ?? "",
    roofType: turf.roofType || "Not verified",
    openingTime: turf.openingTime || "",
    closingTime: turf.closingTime || "",
    slotDurationMinutes: turf.slotDurationMinutes || 60,
    contactNumber: turf.contactNumber || "",
    facilities: (turf.facilities || []).join(", "),
    latitude: turf.latitude ?? "",
    longitude: turf.longitude ?? "",
    weatherLocation: turf.weatherLocation || "",
    description: turf.description || "",
    status: turf.status || (turf.available === false ? "Inactive" : "Active"),
  };
}

export default function TurfManagement() {
  const [turfs, setTurfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [form, setForm] = useState(BLANK_FORM);
  const [equipment, setEquipment] = useState([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [owners, setOwners] = useState({});
  const [ownerForm, setOwnerForm] = useState(BLANK_OWNER);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("name_asc");

  const fetchTurfs = useCallback(async () => {
    try {
      setLoading(true);
      const [data, ownerList] = await Promise.all([getTurfs(), getTurfOwners().catch(() => [])]);
      setTurfs(Array.isArray(data) ? data : []);
      setOwners(Object.fromEntries(ownerList.map((o) => [String(o.turfId), o])));
      setError("");
    } catch (err) {
      setError(err.message || "Unable to load turfs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTurfs();
    const refresh = () => fetchTurfs();
    socket.on("turf:created", refresh);
    socket.on("turf:updated", refresh);
    socket.on("turf:deleted", refresh);
    return () => {
      socket.off("turf:created", refresh);
      socket.off("turf:updated", refresh);
      socket.off("turf:deleted", refresh);
    };
  }, [fetchTurfs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = turfs.filter((t) => {
      if (statusFilter !== "ALL" && (t.status || "Active") !== statusFilter) return false;
      if (!q) return true;
      const owner = owners[String(t._id)];
      return [t.name, t.location, t.address, (t.sports || []).join(" "), t.sportType, owner && owner.name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
    return sortByName(list, sortBy);
  }, [turfs, statusFilter, query, sortBy, owners]);

  function openCreate() {
    setEditingId(null);
    setForm(BLANK_FORM);
    setOwnerForm(BLANK_OWNER);
    setEquipment([]);
    setError("");
    setIsModalOpen(true);
  }

  function openEdit(turf) {
    setEditingId(turf._id);
    setForm(toForm(turf));
    const owner = owners[String(turf._id)];
    setOwnerForm(owner ? { name: owner.name, phone: owner.phone, email: owner.email || "" } : BLANK_OWNER);
    setEquipment((turf.equipment || []).map((e) => ({ name: e.name, rentalCharge: e.rentalCharge ?? 0 })));
    setError("");
    setIsModalOpen(true);
  }

  const change = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  function buildPayload() {
    const numOrNull = (v) => (v === "" || v === null ? null : Number(v));
    return {
      name: form.name.trim(),
      location: form.location.trim(),
      address: form.address.trim(),
      sports: form.sports.split(",").map((s) => s.trim()).filter(Boolean),
      pricePerHour: numOrNull(form.pricePerHour),
      floodlightChargePerHour: numOrNull(form.floodlightChargePerHour),
      roofType: form.roofType,
      openingTime: form.openingTime.trim() || null,
      closingTime: form.closingTime.trim() || null,
      slotDurationMinutes: Number(form.slotDurationMinutes) || 60,
      contactNumber: form.contactNumber.trim(),
      facilities: form.facilities.split(",").map((s) => s.trim()).filter(Boolean),
      latitude: numOrNull(form.latitude),
      longitude: numOrNull(form.longitude),
      weatherLocation: form.weatherLocation.trim(),
      description: form.description.trim(),
      status: form.status,
      equipment: equipment
        .map((e) => ({ name: (e.name || "").trim(), rentalCharge: Math.max(0, Number(e.rentalCharge) || 0) }))
        .filter((e) => e.name),
    };
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.location.trim()) {
      setError("Turf name and area/location are required.");
      return;
    }
    const ownerDigits = ownerForm.phone.replace(/[^0-9]/g, "").slice(-10);
    const hasOwnerInput = ownerForm.name.trim() || ownerForm.phone.trim();
    if (hasOwnerInput && (!ownerForm.name.trim() || !/^[6-9][0-9]{9}$/.test(ownerDigits))) {
      setError("Owner details need a name and a valid 10-digit mobile number (or leave both blank).");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = buildPayload();
      let turfId = editingId;
      if (editingId) {
        await updateTurf(editingId, payload);
        setNotice("Turf updated.");
      } else {
        const created = await createTurf(payload);
        turfId = created && created.turf ? created.turf._id : null;
        setNotice("Turf added.");
      }
      if (turfId) {
        if (hasOwnerInput) {
          await saveTurfOwner(turfId, {
            name: ownerForm.name.trim(),
            phone: ownerDigits,
            email: ownerForm.email.trim(),
          });
        } else if (owners[String(turfId)]) {
          await removeTurfOwner(turfId);
        }
      }
      setIsModalOpen(false);
      setEditingId(null);
      await fetchTurfs();
    } catch (err) {
      setError(err.message || "Unable to save turf.");
    } finally {
      setSaving(false);
    }
  };

  async function toggleStatus(turf) {
    const next = (turf.status || "Active") === "Active" ? "Inactive" : "Active";
    setBusyId(turf._id);
    setError("");
    try {
      await updateTurf(turf._id, { status: next });
      setNotice(`"${turf.name}" is now ${next}.`);
      await fetchTurfs();
    } catch (err) {
      setError(err.message || "Unable to update status.");
    } finally {
      setBusyId("");
    }
  }

  async function handleDelete(turf) {
    if (!window.confirm(`Delete "${turf.name}"? This cannot be undone.`)) return;
    setBusyId(turf._id);
    setError("");
    try {
      await deleteTurf(turf._id);
      setNotice("Turf deleted.");
      setTurfs((prev) => prev.filter((t) => t._id !== turf._id));
      await fetchTurfs();
    } catch (err) {
      if (err.status === 409) {
        if (window.confirm(`${err.message}\n\nForce delete anyway?`)) {
          try {
            await deleteTurf(turf._id, { force: true });
            setNotice("Turf force-deleted.");
            await fetchTurfs();
          } catch (err2) {
            setError(err2.message || "Unable to delete turf.");
          }
        }
      } else {
        setError(err.message || "Unable to delete turf.");
      }
    } finally {
      setBusyId("");
    }
  }

  const counts = {
    all: turfs.length,
    active: turfs.filter((t) => (t.status || "Active") === "Active").length,
    inactive: turfs.filter((t) => t.status === "Inactive").length,
  };

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Turfs &amp; owners</h2>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
            {counts.all} turfs · {counts.active} active · {counts.inactive} inactive
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <IconPlus size={16} /> Add Turf
        </button>
      </div>

      <PageIntro icon={IconPhone} title="Who gets told when someone books?">
        Add each turf's owner (name + mobile number). When a player books, cancels or a teammate pays a split share, an alert is
        prepared for that owner under <em>Owner alerts</em>. You can also share the owner's private booking page with them.
      </PageIntro>

      <div className="toolbar">
        <div className="toolbar-search">
          <span><IconSearch size={15} /></span>
          <input className="form-control" placeholder="Search turf, area, sport or owner" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search turfs" />
        </div>
        <select className="form-control" value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort turfs">
          {SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>

      <div className="filter-pills-group" style={{ marginBottom: 16 }}>
        {["ALL", "Active", "Inactive"].map((s) => (
          <button
            key={s}
            className={`filter-pill ${statusFilter === s ? "active" : ""}`}
            onClick={() => setStatusFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {error && <div className="alert-banner error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
      {notice && !error && (
        <div className="alert-banner" role="status" style={{ marginBottom: 12, background: "#ecfdf5", color: "#047857" }}>
          {notice}
        </div>
      )}

      <div className="card">
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#666" }}>Loading turfs…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#666" }}>
            <IconMapPin size={40} style={{ opacity: 0.4 }} />
            <h3>No turfs</h3>
            <p>Add a turf to get started.</p>
          </div>
        ) : (
          <div className="matches-grid" style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
            {filtered.map((turf) => {
              const active = (turf.status || "Active") === "Active";
              return (
                <div
                  key={turf._id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    padding: 14,
                    opacity: busyId === turf._id ? 0.5 : 1,
                    background: active ? "#fff" : "#f8fafc",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
                    <h4 style={{ margin: "0 0 2px" }}>{turf.name}</h4>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 999,
                        background: active ? "#dcfce7" : "#fee2e2",
                        color: active ? "#166534" : "#991b1b",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {turf.status || "Active"}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
                    <IconMapPin size={12} /> {turf.location}
                  </div>

                  <div style={{ fontSize: 12.5, marginTop: 10, display: "grid", gap: 3, color: "#334155" }}>
                    <span>Sports: {(turf.sports && turf.sports.length ? turf.sports.join(", ") : turf.sportType) || "Not verified"}</span>
                    <span>Price: <strong>{money(turf.pricePerHour)}</strong>{turf.pricePerHour ? " / hr" : ""}</span>
                    <span>Floodlight: {money(turf.floodlightChargePerHour)}{turf.floodlightChargePerHour ? " / hr" : ""}</span>
                    <span>Roof: {turf.roofType || "Not verified"}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><IconClock size={12} /> {hours(turf)}</span>
                    <span>Facilities: {(turf.facilities && turf.facilities.length) ? turf.facilities.join(", ") : "Not verified"}</span>
                    <span>Equipment: {(turf.equipment && turf.equipment.length) ? turf.equipment.map((e) => e.name).join(", ") : "Not verified"}</span>
                    <span>Contact: {turf.contactNumber || "Not verified"}</span>
                    {owners[String(turf._id)] ? (
                      <span>
                        Owner: <strong>{owners[String(turf._id)].name}</strong> · {owners[String(turf._id)].phone}
                      </span>
                    ) : (
                      <span style={{ color: "#b45309", fontWeight: 600 }}>No owner contact — add one to send booking alerts</span>
                    )}
                    <span>Weather: {turf.weatherLocation || "Coimbatore"}{turf.latitude != null ? " (GPS set)" : ""}</span>
                  </div>

                  <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                    <button className="btn btn-outline btn-sm" disabled={busyId === turf._id} onClick={() => openEdit(turf)}>
                      <IconEdit size={13} /> Edit
                    </button>
                    {owners[String(turf._id)] && (
                      <>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(portalUrl(owners[String(turf._id)].accessToken));
                              setNotice("Owner page link copied. Send it to " + owners[String(turf._id)].name + ".");
                            } catch {
                              setError("Couldn't copy the link.");
                            }
                          }}
                        >
                          Copy owner link
                        </button>
                        <a
                          className="btn btn-outline btn-sm"
                          href={portalUrl(owners[String(turf._id)].accessToken)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open owner page
                        </a>
                      </>
                    )}
                    <button className="btn btn-outline btn-sm" disabled={busyId === turf._id} onClick={() => toggleStatus(turf)}>
                      {active ? <><IconX size={13} /> Deactivate</> : <><IconCheck size={13} /> Activate</>}
                    </button>
                    <button className="btn btn-outline-danger btn-sm" disabled={busyId === turf._id} onClick={() => handleDelete(turf)}>
                      <IconTrash size={13} /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? "Edit Turf" : "Add Turf"}
        maxWidth="720px"
      >
        <form onSubmit={handleSubmit} className="admin-form">
          {error && <div className="alert-banner error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}

          <div className="form-group">
            <label>Turf Name *</label>
            <input name="name" value={form.name} onChange={change} required className="form-control" placeholder="e.g. 5th Yard - Football Turf" />
          </div>

          <div className="form-row" style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Area / Location *</label>
              <input name="location" value={form.location} onChange={change} required className="form-control" placeholder="e.g. Singanallur" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Status</label>
              <select name="status" value={form.status} onChange={change} className="form-control">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Full Address <span style={{ color: "#94a3b8" }}>(blank if not verified)</span></label>
            <input name="address" value={form.address} onChange={change} className="form-control" />
          </div>

          <div className="form-row" style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Sports <span style={{ color: "#94a3b8" }}>(comma separated)</span></label>
              <input name="sports" value={form.sports} onChange={change} className="form-control" placeholder="Football, Cricket" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Contact Number</label>
              <input name="contactNumber" value={form.contactNumber} onChange={change} className="form-control" placeholder="+91 …" />
            </div>
          </div>

          <div className="form-row" style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Base Price / hr <span style={{ color: "#94a3b8" }}>(blank = not verified)</span></label>
              <input type="number" min="0" name="pricePerHour" value={form.pricePerHour} onChange={change} className="form-control" placeholder="Not verified" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Floodlight Charge / hr <span style={{ color: "#94a3b8" }}>(blank = not verified)</span></label>
              <input type="number" min="0" name="floodlightChargePerHour" value={form.floodlightChargePerHour} onChange={change} className="form-control" placeholder="Not verified" />
            </div>
          </div>

          <div className="form-row" style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Roof Type</label>
              <select name="roofType" value={form.roofType} onChange={change} className="form-control">
                {ROOF_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Slot Length (mins)</label>
              <input type="number" min="15" step="5" name="slotDurationMinutes" value={form.slotDurationMinutes} onChange={change} className="form-control" />
            </div>
          </div>

          <div className="form-row" style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Opening Time <span style={{ color: "#94a3b8" }}>(HH:MM, blank = not verified)</span></label>
              <input type="time" name="openingTime" value={form.openingTime} onChange={change} className="form-control" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Closing Time <span style={{ color: "#94a3b8" }}>(HH:MM)</span></label>
              <input type="time" name="closingTime" value={form.closingTime} onChange={change} className="form-control" />
            </div>
          </div>

          <div className="form-group">
            <label>Facilities <span style={{ color: "#94a3b8" }}>(comma separated)</span></label>
            <input name="facilities" value={form.facilities} onChange={change} className="form-control" placeholder="Floodlights, Parking, Washroom" />
          </div>

          <div className="form-group">
            <label>Equipment (name + rental charge, 0 = free)</label>
            <div style={{ display: "grid", gap: 6 }}>
              {equipment.map((eq, i) => (
                <div key={i} style={{ display: "flex", gap: 8 }}>
                  <input
                    className="form-control"
                    placeholder="Equipment name"
                    value={eq.name}
                    onChange={(e) => setEquipment((list) => list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  />
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    style={{ maxWidth: 120 }}
                    placeholder="₹"
                    value={eq.rentalCharge}
                    onChange={(e) => setEquipment((list) => list.map((x, j) => (j === i ? { ...x, rentalCharge: e.target.value } : x)))}
                  />
                  <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => setEquipment((list) => list.filter((_, j) => j !== i))}>
                    <IconX size={13} />
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-outline btn-sm" style={{ justifySelf: "start" }} onClick={() => setEquipment((list) => [...list, { name: "", rentalCharge: 0 }])}>
                <IconPlus size={13} /> Add equipment
              </button>
            </div>
          </div>

          <div className="form-row" style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Latitude <span style={{ color: "#94a3b8" }}>(optional)</span></label>
              <input type="number" step="any" name="latitude" value={form.latitude} onChange={change} className="form-control" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Longitude <span style={{ color: "#94a3b8" }}>(optional)</span></label>
              <input type="number" step="any" name="longitude" value={form.longitude} onChange={change} className="form-control" />
            </div>
          </div>

          <div className="form-group">
            <label>Weather Location <span style={{ color: "#94a3b8" }}>(shown on the forecast)</span></label>
            <input name="weatherLocation" value={form.weatherLocation} onChange={change} className="form-control" placeholder="Singanallur, Coimbatore, Tamil Nadu" />
          </div>

          <div className="form-group">
            <label>Notes / Description</label>
            <textarea name="description" value={form.description} onChange={change} className="form-control" rows={2} />
          </div>

          <div style={{ marginTop: 8, padding: 14, borderRadius: 12, background: "#f8fafc", border: "1px solid #eef0f4" }}>
            <strong style={{ display: "block", marginBottom: 2 }}>Turf owner</strong>
            <span className="muted" style={{ display: "block", marginBottom: 10 }}>
              Booking alerts (including split-payment updates) are prepared for this person.
            </span>
            <div className="form-row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div className="form-group" style={{ flex: "1 1 200px" }}>
                <label>Owner name</label>
                <input className="form-control" value={ownerForm.name} onChange={(e) => setOwnerForm((o) => ({ ...o, name: e.target.value }))} placeholder="e.g. Ravi Kumar" />
              </div>
              <div className="form-group" style={{ flex: "1 1 200px" }}>
                <label>Owner mobile (WhatsApp)</label>
                <input className="form-control" value={ownerForm.phone} onChange={(e) => setOwnerForm((o) => ({ ...o, phone: e.target.value.replace(/[^0-9]/g, "").slice(0, 10) }))} placeholder="10-digit number" inputMode="numeric" />
              </div>
            </div>
            <div className="form-group">
              <label>Owner email <span style={{ color: "#94a3b8" }}>(optional)</span></label>
              <input className="form-control" type="email" value={ownerForm.email} onChange={(e) => setOwnerForm((o) => ({ ...o, email: e.target.value }))} placeholder="owner@example.com" />
            </div>
            {editingId && owners[String(editingId)] && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={async () => {
                  if (!window.confirm("Reset the owner's private page link? The old link will stop working.")) return;
                  try {
                    await regenerateOwnerLink(editingId);
                    setNotice("Owner link reset. Copy the new one from the turf card.");
                    await fetchTurfs();
                  } catch (err) {
                    setError(err.message);
                  }
                }}
              >
                Reset owner page link
              </button>
            )}
          </div>

          <div className="form-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save Changes" : "Add Turf"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
