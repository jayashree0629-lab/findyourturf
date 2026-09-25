import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  MapPin,
  Calendar,
  Clock,
  IndianRupee,
  MessageCircle,
  X,
  Phone,
  Users,
  Search,
} from "lucide-react";
import PageShell, { CommunityTabs, SkeletonList } from "../components/PageShell";
import EmptyState from "../components/EmptyState";
import { useIdentity, useToast } from "../components/AppProviders";
import {
  getPlayerRequests,
  createPlayerRequest,
  joinPlayerRequest,
  leavePlayerRequest,
  closePlayerRequest,
  getPlayerContacts,
  getTurfs,
} from "../services/api";
import { socket } from "../services/socket";

const SPORTS = ["Cricket", "Box Cricket", "Football", "Badminton", "Tennis", "Basketball", "Volleyball", "Other"];
const SKILLS = ["Any", "Beginner", "Intermediate", "Advanced"];

function timeOptions() {
  const out = [];
  for (let h = 5; h <= 23; h += 1) {
    for (const m of [0, 30]) {
      const suffix = h >= 12 ? "PM" : "AM";
      const hh = h % 12 === 0 ? 12 : h % 12;
      out.push(`${hh}:${m === 0 ? "00" : "30"} ${suffix}`);
    }
  }
  return out;
}
const TIMES = timeOptions();

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

function fmtDate(value) {
  const d = new Date(value);
  const today = new Date();
  const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - utcToday) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

function CreateModal({ turfNames, identity, onClose, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState({
    sport: "Cricket",
    turfName: "",
    area: "",
    date: todayISO(),
    time: "7:00 PM",
    playersNeeded: 4,
    skillLevel: "Any",
    costPerPlayer: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await createPlayerRequest({
        ...form,
        name: identity.name,
        phone: identity.phone,
        playersNeeded: Number(form.playersNeeded),
        costPerPlayer: Number(form.costPerPlayer) || 0,
      });
      toast.success("Your game is live! Players can now join.");
      onCreated();
    } catch (err) {
      setError(err.message || "Couldn't post your request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fyt-x-overlay" role="presentation" onClick={onClose}>
      <form className="fyt-x-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="fp-create-title">
        <div className="fyt-x-modal-head">
          <div>
            <h2 id="fp-create-title">Need players?</h2>
            <p className="fyt-x-sub" style={{ marginTop: 4 }}>Post your game and let others join in.</p>
          </div>
          <button type="button" className="fyt-x-modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="fyt-x-form-grid">
          <div className="fyt-x-field">
            <label>Sport</label>
            <select className="fyt-x-select" value={form.sport} onChange={set("sport")}>
              {SPORTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="fyt-x-field">
            <label>Players needed</label>
            <input className="fyt-x-input" type="number" min="1" max="30" value={form.playersNeeded} onChange={set("playersNeeded")} required />
          </div>
          <div className="fyt-x-field">
            <label>Date</label>
            <input className="fyt-x-input" type="date" min={todayISO()} value={form.date} onChange={set("date")} required />
          </div>
          <div className="fyt-x-field">
            <label>Start time</label>
            <select className="fyt-x-select" value={form.time} onChange={set("time")}>
              {TIMES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="fyt-x-field full">
            <label>Turf / venue <span className="fyt-x-muted">(optional)</span></label>
            <input className="fyt-x-input" list="fp-turfs" value={form.turfName} onChange={set("turfName")} placeholder="Pick a turf or type your own" maxLength={80} />
            <datalist id="fp-turfs">{turfNames.map((n) => <option key={n} value={n} />)}</datalist>
          </div>
          <div className="fyt-x-field">
            <label>Area</label>
            <input className="fyt-x-input" value={form.area} onChange={set("area")} placeholder="e.g. Peelamedu" maxLength={60} />
          </div>
          <div className="fyt-x-field">
            <label>Skill level</label>
            <select className="fyt-x-select" value={form.skillLevel} onChange={set("skillLevel")}>
              {SKILLS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="fyt-x-field">
            <label>Cost per player (₹)</label>
            <input className="fyt-x-input" type="number" min="0" value={form.costPerPlayer} onChange={set("costPerPlayer")} placeholder="0 = free" />
          </div>
          <div className="fyt-x-field full">
            <label>Notes <span className="fyt-x-muted">(optional)</span></label>
            <textarea className="fyt-x-textarea" style={{ minHeight: 70 }} value={form.notes} onChange={set("notes")} maxLength={300} placeholder="Bring your own bat? Tennis-ball match? Anything players should know." />
          </div>
        </div>

        {error && <div className="fyt-x-inline-msg error" style={{ marginTop: 12 }}>{error}</div>}
        <div className="fyt-x-modal-actions">
          <button type="button" className="fyt-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="fyt-btn-primary" disabled={busy}>{busy ? "Posting…" : "Post game"}</button>
        </div>
      </form>
    </div>
  );
}

function ContactsModal({ request, identity, onClose }) {
  const [state, setState] = useState({ loading: true, data: null, error: "" });

  useEffect(() => {
    let active = true;
    getPlayerContacts(request._id, identity.phone)
      .then((data) => active && setState({ loading: false, data, error: "" }))
      .catch((err) => active && setState({ loading: false, data: null, error: err.message }));
    return () => {
      active = false;
    };
  }, [request._id, identity.phone]);

  const { data } = state;
  return (
    <div className="fyt-x-overlay" role="presentation" onClick={onClose}>
      <div className="fyt-x-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="fyt-x-modal-head">
          <h2>{data?.role === "host" ? "Players who joined" : "Host contact"}</h2>
          <button className="fyt-x-modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {state.loading && <p className="fyt-x-sub">Loading…</p>}
        {state.error && <div className="fyt-x-inline-msg error">{state.error}</div>}
        {data?.role === "host" && (
          data.joiners.length === 0 ? (
            <p className="fyt-x-sub">Nobody has joined yet. Share the game to get players in.</p>
          ) : (
            <div className="fyt-x-stack">
              {data.joiners.map((j) => (
                <div key={j.phone} className="fyt-x-contact-box fyt-x-row between">
                  <strong>{j.name}</strong>
                  <a href={`tel:+91${j.phone}`}><Phone size={13} /> +91 {j.phone}</a>
                </div>
              ))}
            </div>
          )
        )}
        {data?.role === "joiner" && (
          <div className="fyt-x-contact-box fyt-x-row between">
            <strong>{data.host.name}</strong>
            <a href={`tel:+91${data.host.phone}`}><Phone size={13} /> +91 {data.host.phone}</a>
          </div>
        )}
      </div>
    </div>
  );
}

function RequestCard({ r, busyId, onJoin, onLeave, onClose, onContacts, onChat }) {
  const busy = busyId === r._id;
  const spots = Array.from({ length: r.playersNeeded }, (_, i) => i < r.joinedCount);
  const full = r.status === "Full" || r.spotsLeft === 0;

  return (
    <article className="fyt-x-card fyt-x-stack" style={{ gap: 12 }}>
      <div className="fyt-x-row between" style={{ alignItems: "flex-start" }}>
        <div className="fyt-x-row" style={{ flexWrap: "nowrap" }}>
          <span className="fyt-x-avatar">{r.hostName.charAt(0).toUpperCase()}</span>
          <div>
            <h3 className="fyt-x-card-title">{r.sport}</h3>
            <span className="fyt-x-sub">Hosted by {r.isHost ? "you" : r.hostName}</span>
          </div>
        </div>
        <div className="fyt-x-row" style={{ gap: 6 }}>
          {r.skillLevel !== "Any" && <span className="fyt-x-badge info">{r.skillLevel}</span>}
          <span className={`fyt-x-badge ${full ? "warn" : "success"}`}>{full ? "Full" : `${r.spotsLeft} left`}</span>
        </div>
      </div>

      <div className="fyt-x-meta">
        <span><Calendar size={13} /> {fmtDate(r.date)}</span>
        <span><Clock size={13} /> {r.time}</span>
        {(r.turfName || r.area) && (
          <span><MapPin size={13} /> {[r.turfName, r.area].filter(Boolean).join(" · ")}</span>
        )}
        <span><IndianRupee size={13} /> {r.costPerPlayer > 0 ? `₹${r.costPerPlayer} / player` : "Free"}</span>
      </div>

      {r.notes && <p className="fyt-x-sub" style={{ lineHeight: 1.5 }}>{r.notes}</p>}

      <div className="fyt-x-row between">
        <div className="fyt-x-row" style={{ gap: 8 }}>
          <span className="fyt-x-spots" aria-label={`${r.joinedCount} of ${r.playersNeeded} spots filled`}>
            {spots.map((filled, i) => <i key={i} className={`fyt-x-spot ${filled ? "filled" : ""}`} />)}
          </span>
          <span className="fyt-x-muted">
            {r.joinedCount}/{r.playersNeeded} joined
            {r.joinerNames.length > 0 && ` · ${r.joinerNames.slice(0, 2).join(", ")}${r.joinerNames.length > 2 ? "…" : ""}`}
          </span>
        </div>
      </div>

      <div className="fyt-x-row">
        {r.isHost ? (
          <>
            <button className="fyt-btn-secondary fyt-x-btn-sm" onClick={() => onContacts(r)}><Users size={14} /> Players</button>
            <button className="fyt-btn-secondary fyt-x-btn-sm" onClick={() => onChat(r)}><MessageCircle size={14} /> Group chat</button>
            {r.status !== "Closed" && (
              <button className="fyt-x-btn-danger" onClick={() => onClose(r)} disabled={busy}>Close game</button>
            )}
          </>
        ) : r.hasJoined ? (
          <>
            <button className="fyt-btn-secondary fyt-x-btn-sm" onClick={() => onContacts(r)}><Phone size={14} /> Host contact</button>
            <button className="fyt-btn-secondary fyt-x-btn-sm" onClick={() => onChat(r)}><MessageCircle size={14} /> Group chat</button>
            <button className="fyt-x-btn-danger" onClick={() => onLeave(r)} disabled={busy}>Leave</button>
          </>
        ) : (
          <button className="fyt-btn-primary fyt-x-btn-sm" onClick={() => onJoin(r)} disabled={busy || full}>
            {busy ? "Joining…" : full ? "Game full" : "Join game"}
          </button>
        )}
      </div>
    </article>
  );
}

export default function FindPlayers() {
  const navigate = useNavigate();
  const toast = useToast();
  const { identity, requireIdentity } = useIdentity();

  const [sport, setSport] = useState("All");
  const [area, setArea] = useState("");
  const [mine, setMine] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [contactsFor, setContactsFor] = useState(null);
  const [turfNames, setTurfNames] = useState([]);

  const phone = identity.ready ? identity.phone : "";

  const load = useCallback(async () => {
    setError("");
    try {
      setRequests(await getPlayerRequests({ sport, area: area.trim(), phone, mine: mine && Boolean(phone) }));
    } catch (err) {
      setError(err.message || "Couldn't load games.");
    } finally {
      setLoading(false);
    }
  }, [sport, area, phone, mine]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(load, area ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, area]);

  useEffect(() => {
    socket.on("players:changed", load);
    return () => socket.off("players:changed", load);
  }, [load]);

  useEffect(() => {
    getTurfs()
      .then((d) => {
        const list = Array.isArray(d) ? d : d.turfs || [];
        setTurfNames(list.map((t) => t.name).filter(Boolean));
      })
      .catch(() => {});
  }, []);

  const withIdentity = async (reason) => {
    const id = identity.ready ? identity : await requireIdentity(reason);
    return id && id.ready ? id : null;
  };

  const handlePost = async () => {
    if (await withIdentity("Add your details so players can reach you.")) setShowCreate(true);
  };

  const handleJoin = async (r) => {
    const id = await withIdentity("Add your details so the host knows who's joining.");
    if (!id) return;
    setBusyId(r._id);
    try {
      const res = await joinPlayerRequest(r._id, { name: id.name, phone: id.phone });
      toast.success(`You're in! Host: ${res.host.name} · +91 ${res.host.phone}`);
      await load();
    } catch (err) {
      toast.error(err.message);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const handleLeave = async (r) => {
    if (!window.confirm("Leave this game?")) return;
    setBusyId(r._id);
    try {
      await leavePlayerRequest(r._id, phone);
      toast.success("You left the game.");
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleClose = async (r) => {
    if (!window.confirm("Close this game? It will stop accepting players.")) return;
    setBusyId(r._id);
    try {
      await closePlayerRequest(r._id, phone);
      toast.success("Game closed.");
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const shown = useMemo(() => requests, [requests]);

  return (
    <PageShell
      title="Find Players"
      subtitle="Short of a team? Post your game, or join one that's already forming near you."
      actions={
        <button className="fyt-btn-primary" onClick={handlePost}>
          <Plus size={16} /> Post a game
        </button>
      }
    >
      <CommunityTabs />

      <div className="fyt-x-row" style={{ marginBottom: 6 }}>
        <div className="fyt-input-with-icon" style={{ flex: "1 1 220px", maxWidth: 360 }}>
          <Search size={16} />
          <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Search by area (e.g. Peelamedu)" aria-label="Search by area" />
        </div>
        <button className={`fyt-x-chip ${mine ? "active" : ""}`} onClick={async () => {
          if (!mine && !(await withIdentity("Add your details to see your games."))) return;
          setMine((m) => !m);
        }}>
          My games
        </button>
      </div>
      <div className="fyt-x-chips" role="group" aria-label="Sport filter">
        {["All", ...SPORTS].map((s) => (
          <button key={s} className={`fyt-x-chip ${sport === s ? "active" : ""}`} onClick={() => setSport(s)}>{s}</button>
        ))}
      </div>

      {error && (
        <div className="fyt-x-inline-msg error" style={{ marginBottom: 12 }}>
          {error} <button className="fyt-x-btn-ghost" onClick={load}>Retry</button>
        </div>
      )}

      {loading ? (
        <SkeletonList count={4} height={200} />
      ) : shown.length === 0 ? (
        <EmptyState
          type="search"
          icon={<Users size={36} />}
          title={mine ? "No games yet" : "No open games right now"}
          message={
            mine
              ? "Games you host or join will appear here."
              : "Be the first — post a game and players nearby can join you."
          }
          actionLabel="Post a game"
          onAction={handlePost}
        />
      ) : (
        <div className="fyt-x-grid">
          {shown.map((r) => (
            <RequestCard
              key={r._id}
              r={r}
              busyId={busyId}
              onJoin={handleJoin}
              onLeave={handleLeave}
              onClose={handleClose}
              onContacts={setContactsFor}
              onChat={(req) => navigate(`/chat/req-${req._id}`)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateModal
          turfNames={turfNames}
          identity={identity}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
      {contactsFor && <ContactsModal request={contactsFor} identity={identity} onClose={() => setContactsFor(null)} />}
    </PageShell>
  );
}
