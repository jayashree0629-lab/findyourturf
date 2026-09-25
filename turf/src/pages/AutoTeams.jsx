import { useEffect, useState } from "react";
import { Plus, Trash2, Shuffle, Copy, Share2, Users, Star, ClipboardList } from "lucide-react";
import PageShell, { CommunityTabs } from "../components/PageShell";
import EmptyState from "../components/EmptyState";
import { useIdentity, useToast } from "../components/AppProviders";
import { getPlayerRequests, getPlayerContacts } from "../services/api";

const STORAGE_KEY = "fyt_autoteams_v1";
const ROLES = ["Any", "Batter", "Bowler", "All-rounder", "Keeper", "Defender", "Midfielder", "Forward", "Goalkeeper"];
const TEAM_COLORS = ["#4058F5", "#10B981", "#F59E0B", "#F43F5E", "#8B5CF6", "#0EA5E9"];

let uid = 0;
const newId = () => `p${Date.now().toString(36)}${uid++}`;

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Greedy balanced split. Strongest players are placed first; each goes to the
// team with the lowest total skill that still has room, so team strengths end
// up close. With `balanceRoles`, players of the same role are spread across
// teams first (e.g. every team gets a keeper / bowlers).
function buildTeams(players, teamCount, balanceRoles) {
  const teams = Array.from({ length: teamCount }, (_, i) => ({
    name: `Team ${String.fromCharCode(65 + i)}`,
    players: [],
    total: 0,
  }));
  const capacity = Math.ceil(players.length / teamCount);

  const pickTeam = (role) => {
    const open = teams.filter((t) => t.players.length < capacity);
    const roleCount = (t) => (balanceRoles && role !== "Any" ? t.players.filter((p) => p.role === role).length : 0);
    return shuffle(open).sort(
      (a, b) => roleCount(a) - roleCount(b) || a.total - b.total || a.players.length - b.players.length
    )[0];
  };

  const ordered = shuffle(players).sort((a, b) => b.skill - a.skill);
  const byRole = balanceRoles
    ? [...ordered].sort((a, b) => (a.role === "Any") - (b.role === "Any") || a.role.localeCompare(b.role) || b.skill - a.skill)
    : ordered;

  byRole.forEach((p) => {
    const team = pickTeam(p.role);
    team.players.push(p);
    team.total += p.skill;
  });
  return teams;
}

function loadSaved() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (raw && Array.isArray(raw.players)) return raw;
  } catch {
    /* ignore */
  }
  return null;
}

function Stars({ value }) {
  return <span className="fyt-x-stars" aria-label={`${value} of 5`}>{"★".repeat(value)}{"☆".repeat(5 - value)}</span>;
}

export default function AutoTeams() {
  const toast = useToast();
  const { identity } = useIdentity();
  const [saved] = useState(loadSaved);
  const [players, setPlayers] = useState(saved?.players || []);
  const [teamCount, setTeamCount] = useState(saved?.teamCount || 2);
  const [balanceRoles, setBalanceRoles] = useState(saved?.balanceRoles || false);
  const [name, setName] = useState("");
  const [skill, setSkill] = useState(3);
  const [role, setRole] = useState("Any");
  const [bulk, setBulk] = useState("");
  const [teams, setTeams] = useState(null);
  const [myGames, setMyGames] = useState([]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ players, teamCount, balanceRoles }));
    } catch {
      /* ignore */
    }
  }, [players, teamCount, balanceRoles]);

  useEffect(() => {
    if (!identity.ready) return;
    getPlayerRequests({ phone: identity.phone, mine: true })
      .then((list) => setMyGames(list.filter((g) => g.isHost && g.status !== "Closed")))
      .catch(() => {});
  }, [identity.ready, identity.phone]);

  const maxTeams = Math.max(2, Math.min(6, players.length));
  const effectiveTeams = Math.min(teamCount, maxTeams);

  const addPlayer = (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    if (players.some((p) => p.name.toLowerCase() === n.toLowerCase())) {
      toast.error(`${n} is already on the list.`);
      return;
    }
    setPlayers((prev) => [...prev, { id: newId(), name: n.slice(0, 40), skill, role }]);
    setName("");
    setTeams(null);
  };

  const addBulk = () => {
    const names = bulk
      .split(/[\n,]+/)
      .map((n) => n.trim())
      .filter(Boolean);
    const existing = new Set(players.map((p) => p.name.toLowerCase()));
    const fresh = [];
    names.forEach((n) => {
      if (!existing.has(n.toLowerCase())) {
        existing.add(n.toLowerCase());
        fresh.push({ id: newId(), name: n.slice(0, 40), skill: 3, role: "Any" });
      }
    });
    setPlayers((prev) => [...prev, ...fresh]);
    setBulk("");
    setTeams(null);
    toast.success(`${fresh.length} player${fresh.length === 1 ? "" : "s"} added.`);
  };

  const importFromGame = async (gameId) => {
    if (!gameId) return;
    try {
      const data = await getPlayerContacts(gameId, identity.phone);
      const names = [identity.name, ...(data.joiners || []).map((j) => j.name)];
      const existing = new Set(players.map((p) => p.name.toLowerCase()));
      const fresh = names
        .filter((n) => n && !existing.has(n.toLowerCase()))
        .map((n) => ({ id: newId(), name: n.slice(0, 40), skill: 3, role: "Any" }));
      setPlayers((prev) => [...prev, ...fresh]);
      setTeams(null);
      toast.success(`Added ${fresh.length} player${fresh.length === 1 ? "" : "s"} from your game.`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const update = (id, patch) => {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setTeams(null);
  };

  const generate = () => {
    if (players.length < 2) {
      toast.error("Add at least 2 players first.");
      return;
    }
    setTeams(buildTeams(players, effectiveTeams, balanceRoles));
  };

  const summary = () =>
    (teams || [])
      .map((t) => `${t.name} (strength ${t.total})\n${t.players.map((p) => `• ${p.name}${p.role !== "Any" ? ` – ${p.role}` : ""}`).join("\n")}`)
      .join("\n\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary());
      toast.success("Teams copied.");
    } catch {
      toast.error("Couldn't copy — select the text manually.");
    }
  };

  const share = () => {
    const text = `Today's teams 🏏⚽\n\n${summary()}`;
    if (navigator.share) navigator.share({ title: "Teams", text }).catch(() => {});
    else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <PageShell
      title="Auto Teams"
      subtitle="Add your squad, rate everyone from 1 to 5, and get fair, balanced teams in one tap."
    >
      <CommunityTabs />

      <div className="fyt-x-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", alignItems: "start" }}>
        <section className="fyt-x-card fyt-x-stack">
          <div className="fyt-x-row between">
            <h2 className="fyt-x-card-title">Players ({players.length})</h2>
            {players.length > 0 && (
              <button className="fyt-x-btn-ghost" onClick={() => { setPlayers([]); setTeams(null); }}>Clear all</button>
            )}
          </div>

          <form className="fyt-x-stack" style={{ gap: 8 }} onSubmit={addPlayer}>
            <div className="fyt-x-row" style={{ flexWrap: "nowrap" }}>
              <input className="fyt-x-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Player name" maxLength={40} aria-label="Player name" />
              <button className="fyt-btn-primary" type="submit" aria-label="Add player" style={{ padding: "12px 16px" }}><Plus size={18} /></button>
            </div>
            <div className="fyt-x-form-grid">
              <div className="fyt-x-field">
                <label>Skill ({skill}/5)</label>
                <input type="range" min="1" max="5" value={skill} onChange={(e) => setSkill(Number(e.target.value))} style={{ width: "100%" }} />
              </div>
              <div className="fyt-x-field">
                <label>Role</label>
                <select className="fyt-x-select" style={{ minHeight: 40, padding: "6px 12px" }} value={role} onChange={(e) => setRole(e.target.value)}>
                  {ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
          </form>

          {players.length === 0 ? (
            <EmptyState type="search" icon={<Users size={32} />} title="No players yet" message="Add names one by one, or paste your whole squad below." />
          ) : (
            <div className="fyt-x-stack" style={{ gap: 6 }}>
              {players.map((p) => (
                <div key={p.id} className="fyt-x-player-row">
                  <div>
                    <strong style={{ fontSize: 14 }}>{p.name}</strong>
                    <div className="fyt-x-row" style={{ gap: 8 }}>
                      <Stars value={p.skill} />
                      <span className="fyt-x-muted">{p.role !== "Any" ? p.role : ""}</span>
                    </div>
                  </div>
                  <input type="range" min="1" max="5" value={p.skill} onChange={(e) => update(p.id, { skill: Number(e.target.value) })} aria-label={`Skill for ${p.name}`} />
                  <button className="fyt-x-modal-close" onClick={() => { setPlayers((prev) => prev.filter((x) => x.id !== p.id)); setTeams(null); }} aria-label={`Remove ${p.name}`}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          )}

          <hr className="fyt-x-divider" style={{ margin: "4px 0" }} />
          <div className="fyt-x-field">
            <label><ClipboardList size={12} style={{ verticalAlign: "-2px" }} /> Paste a list (one name per line, or comma separated)</label>
            <textarea className="fyt-x-textarea" style={{ minHeight: 70 }} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={"Karthik\nArun\nDinesh"} />
            <button className="fyt-btn-secondary fyt-x-btn-sm" style={{ marginTop: 8 }} onClick={addBulk} disabled={!bulk.trim()}>Add these players</button>
          </div>
          {myGames.length > 0 && (
            <div className="fyt-x-field">
              <label>Or load from a game you're hosting</label>
              <select className="fyt-x-select" defaultValue="" onChange={(e) => { importFromGame(e.target.value); e.target.value = ""; }}>
                <option value="" disabled>Choose a game…</option>
                {myGames.map((g) => <option key={g._id} value={g._id}>{g.sport} · {g.time} ({g.joinedCount} joined)</option>)}
              </select>
            </div>
          )}
        </section>

        <section className="fyt-x-stack">
          <div className="fyt-x-card fyt-x-stack">
            <h2 className="fyt-x-card-title">Settings</h2>
            <div className="fyt-x-field">
              <label>Number of teams</label>
              <div className="fyt-x-chips" role="group" aria-label="Number of teams">
                {[2, 3, 4, 5, 6].map((n) => (
                  <button key={n} className={`fyt-x-chip ${effectiveTeams === n ? "active" : ""}`} onClick={() => { setTeamCount(n); setTeams(null); }} disabled={n > maxTeams}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <label className="fyt-x-row" style={{ cursor: "pointer", fontSize: 14 }}>
              <input type="checkbox" checked={balanceRoles} onChange={(e) => { setBalanceRoles(e.target.checked); setTeams(null); }} />
              Spread roles evenly (keepers, bowlers, defenders…)
            </label>
            <button className="fyt-btn-primary" onClick={generate} disabled={players.length < 2}>
              <Shuffle size={16} /> {teams ? "Shuffle again" : "Make teams"}
            </button>
          </div>

          {teams && (
            <>
              <div className="fyt-x-row">
                <button className="fyt-btn-secondary fyt-x-btn-sm" onClick={copy}><Copy size={14} /> Copy</button>
                <button className="fyt-btn-secondary fyt-x-btn-sm" onClick={share}><Share2 size={14} /> Share</button>
              </div>
              {teams.map((t, i) => (
                <div key={t.name} className="fyt-x-card" style={{ borderTop: `4px solid ${TEAM_COLORS[i % TEAM_COLORS.length]}` }}>
                  <div className="fyt-x-team-head">
                    <h3 className="fyt-x-card-title">{t.name}</h3>
                    <span className="fyt-x-badge"><Star size={11} /> {t.total} · {t.players.length} players</span>
                  </div>
                  <div className="fyt-x-team-list">
                    {t.players.map((p) => (
                      <div key={p.id} className="fyt-x-team-player">
                        <span>{p.name}{p.role !== "Any" && <span className="fyt-x-muted"> · {p.role}</span>}</span>
                        <Stars value={p.skill} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </section>
      </div>
    </PageShell>
  );
}
