import { useState, useEffect, useCallback, useMemo } from "react";
import Modal from "../components/common/Modal";
import { IconPlus, IconAward, IconTrash } from "../components/common/Icons";
import { getCoupons, createCoupon, setCouponActive, deleteCoupon } from "../services/api";
import {
  useFlash,
  FlashBanner,
  PageHeader,
  Pill,
  EmptyBox,
  ConfirmModal,
  formatDate,
} from "../components/common/adminUi";

const BLANK = {
  code: "",
  label: "",
  type: "PERCENT",
  value: "",
  maxDiscount: "",
  minOrder: "",
  maxUses: "",
  phone: "",
  expiresAt: "",
};

const FILTERS = ["Active", "All", "Expired / Off"];

function statusOf(c) {
  const expired = c.expiresAt && new Date(c.expiresAt) < new Date();
  const exhausted = c.maxUses > 0 && c.usedCount >= c.maxUses;
  if (!c.active) return { label: "Disabled", tone: "slate", live: false };
  if (expired) return { label: "Expired", tone: "red", live: false };
  if (exhausted) return { label: "Fully used", tone: "amber", live: false };
  return { label: "Active", tone: "green", live: true };
}

const SOURCE_TONE = { REWARD: "blue", ZONE: "amber", ADMIN: "slate" };

export default function CouponsManagement() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("Active");
  const [flash, setFlash] = useFlash();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const load = useCallback(async () => {
    try {
      setCoupons(await getCoupons());
    } catch (err) {
      setFlash("error", err.message || "Couldn't load coupons.");
    } finally {
      setLoading(false);
    }
  }, [setFlash]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(
    () =>
      coupons.filter((c) => {
        const live = statusOf(c).live;
        return filter === "All" || (filter === "Active" ? live : !live);
      }),
    [coupons, filter]
  );

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await createCoupon({
        code: form.code,
        label: form.label,
        type: form.type,
        value: Number(form.value),
        maxDiscount: Number(form.maxDiscount) || 0,
        minOrder: Number(form.minOrder) || 0,
        maxUses: Number(form.maxUses) || 0,
        phone: form.phone.trim(),
        expiresAt: form.expiresAt || undefined,
      });
      setFlash("success", `Coupon ${created.code} created.`);
      setForm(null);
      await load();
    } catch (err) {
      setFlash("error", err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c) => {
    try {
      await setCouponActive(c._id, !c.active);
      setFlash("success", `${c.code} ${c.active ? "disabled" : "enabled"}.`);
      await load();
    } catch (err) {
      setFlash("error", err.message);
    }
  };

  const remove = async () => {
    try {
      await deleteCoupon(toDelete._id);
      setFlash("success", `${toDelete.code} deleted.`);
      setToDelete(null);
      await load();
    } catch (err) {
      setFlash("error", err.message);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <PageHeader
        title="Coupons"
        subtitle="Promo codes players can apply at checkout. Reward and Student/Corporate coupons are created automatically and show up here too."
      >
        <button className="btn btn-primary" onClick={() => setForm({ ...BLANK })}>
          <IconPlus size={16} /> New coupon
        </button>
      </PageHeader>

      <FlashBanner flash={flash} onDismiss={() => setFlash(null)} />

      <div className="filter-pills-group" style={{ marginBottom: 14 }}>
        {FILTERS.map((f) => (
          <button key={f} className={`filter-pill ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#666" }}>Loading coupons…</div>
        ) : rows.length === 0 ? (
          <EmptyBox icon={IconAward} title="No coupons here" text="Create a promo code like WELCOME100 to reward new players." />
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Rules</th>
                  <th>Used</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const st = statusOf(c);
                  return (
                    <tr key={c._id}>
                      <td>
                        <div style={{ fontWeight: 800, fontFamily: "monospace", letterSpacing: 0.5 }}>{c.code}</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>{c.label || "—"}</div>
                      </td>
                      <td style={{ fontWeight: 700 }}>
                        {c.type === "PERCENT" ? `${c.value}%` : `₹${c.value}`}
                        {c.type === "PERCENT" && c.maxDiscount > 0 && (
                          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>up to ₹{c.maxDiscount}</div>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: "#475569" }}>
                        <Pill tone={SOURCE_TONE[c.source] || "slate"}>{c.source}</Pill>
                        {c.minOrder > 0 && <div>Min ₹{c.minOrder}</div>}
                        {c.phone && <div>Only {c.phone}</div>}
                      </td>
                      <td>
                        {c.usedCount}
                        {c.maxUses > 0 ? ` / ${c.maxUses}` : " / ∞"}
                      </td>
                      <td>{c.expiresAt ? formatDate(c.expiresAt) : "Never"}</td>
                      <td>
                        <Pill tone={st.tone}>{st.label}</Pill>
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => toggle(c)}>
                          {c.active ? "Disable" : "Enable"}
                        </button>{" "}
                        <button className="btn btn-outline-danger btn-sm" onClick={() => setToDelete(c)} aria-label={`Delete ${c.code}`}>
                          <IconTrash size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={Boolean(form)} onClose={() => setForm(null)} title="New coupon" maxWidth="560px">
        {form && (
          <form onSubmit={save}>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group col-6">
                  <label className="form-label">Code (leave blank to auto-generate)</label>
                  <input className="form-control" value={form.code} onChange={set("code")} placeholder="WELCOME100" maxLength={20} style={{ textTransform: "uppercase" }} />
                </div>
                <div className="form-group col-6">
                  <label className="form-label">Label (shown to players)</label>
                  <input className="form-control" value={form.label} onChange={set("label")} placeholder="Welcome offer" maxLength={80} />
                </div>
                <div className="form-group col-4">
                  <label className="form-label">Type</label>
                  <select className="form-control" value={form.type} onChange={set("type")}>
                    <option value="PERCENT">Percent off</option>
                    <option value="FLAT">Flat ₹ off</option>
                  </select>
                </div>
                <div className="form-group col-4">
                  <label className="form-label">{form.type === "PERCENT" ? "Percent (1-100)" : "Amount (₹)"}</label>
                  <input className="form-control" type="number" min="1" max={form.type === "PERCENT" ? 100 : undefined} value={form.value} onChange={set("value")} required />
                </div>
                <div className="form-group col-4">
                  <label className="form-label">Max discount (₹)</label>
                  <input className="form-control" type="number" min="0" value={form.maxDiscount} onChange={set("maxDiscount")} disabled={form.type !== "PERCENT"} placeholder="No cap" />
                </div>
                <div className="form-group col-4">
                  <label className="form-label">Min booking (₹)</label>
                  <input className="form-control" type="number" min="0" value={form.minOrder} onChange={set("minOrder")} placeholder="None" />
                </div>
                <div className="form-group col-4">
                  <label className="form-label">Total uses</label>
                  <input className="form-control" type="number" min="0" value={form.maxUses} onChange={set("maxUses")} placeholder="0 = unlimited" />
                </div>
                <div className="form-group col-4">
                  <label className="form-label">Expires on</label>
                  <input className="form-control" type="date" value={form.expiresAt} onChange={set("expiresAt")} />
                </div>
                <div className="form-group col-12">
                  <label className="form-label">Restrict to one player's phone (optional)</label>
                  <input className="form-control" value={form.phone} onChange={set("phone")} placeholder="10-digit mobile number" inputMode="numeric" />
                </div>
              </div>
              <p style={{ margin: "12px 0 0", fontSize: 12, color: "#64748b" }}>
                Each phone number can use a given code only once. Cancelling a booking returns the coupon to the player.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving…" : "Create coupon"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmModal
        isOpen={Boolean(toDelete)}
        danger
        title="Delete coupon?"
        message={toDelete ? `${toDelete.code} will be removed permanently. Bookings that already used it keep their discount.` : ""}
        confirmLabel="Delete"
        onConfirm={remove}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
