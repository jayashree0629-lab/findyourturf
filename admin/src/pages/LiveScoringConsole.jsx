import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { socket } from "../services/socket";
import { IconArrowLeft } from "../components/common/Icons";
import Modal from "../components/common/Modal";
import {
  getLiveMatchDetails,
  updateLiveMatchState,
  scoreLiveBall,
  undoLiveBall,
  completeLiveMatch,
  endLiveInnings,
} from "../services/api";

const OUT_TYPES = ["Bowled", "Caught", "LBW", "Stumped", "Hit Wicket", "Run Out"];
const NEEDS_FIELDER = ["Caught", "Stumped", "Run Out"];

function oversText(legalBalls = 0) {
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
}

function crrOf(runs = 0, legalBalls = 0) {
  if (!legalBalls) return "0.00";
  return (runs / (legalBalls / 6)).toFixed(2);
}

function srOf(runs = 0, balls = 0) {
  if (!balls) return "0.00";
  return ((runs / balls) * 100).toFixed(2);
}

function extrasLine(inn = {}) {
  return `Wd ${inn.wides || 0} · NB ${inn.noBalls || 0} · B ${inn.byes || 0} · LB ${inn.legByes || 0}`;
}

// Style a delivery symbol ("•", "4", "W", "Wd", "Nb1", "2B", ...).
function ballStyle(symRaw) {
  const sym = String(symRaw || "");
  const base = {
    minWidth: 30, height: 30, padding: "0 6px", borderRadius: 15, display: "inline-flex",
    alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800,
    background: "#eef2f7", color: "#334155",
  };
  if (/w/i.test(sym) && /^\d*\+?w$/i.test(sym)) return { ...base, background: "#e11d48", color: "#fff" };
  if (/^(wd|nb)/i.test(sym)) return { ...base, background: "#fef3c7", color: "#92400e" };
  if (/b$/i.test(sym)) return { ...base, background: "#dbeafe", color: "#1e40af" };
  if (sym === "6") return { ...base, background: "#16a34a", color: "#fff" };
  if (sym === "4") return { ...base, background: "#2563eb", color: "#fff" };
  return base;
}

function BallChip({ sym }) {
  return <span style={ballStyle(sym)}>{sym === "•" ? "0" : sym}</span>;
}

// Name box + Set button; used for the incoming batter / next bowler.
function NameEntry({ placeholder, listId, busy, onSubmit, buttonLabel = "Set" }) {
  const [value, setValue] = useState("");
  const submit = () => {
    const name = value.trim();
    if (!name || busy) return;
    onSubmit(name);
    setValue("");
  };
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input
        className="form-control"
        style={{ height: 34, minWidth: 130 }}
        list={listId}
        placeholder={placeholder}
        value={value}
        disabled={busy}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submit())}
      />
      <button className="btn btn-primary btn-sm" disabled={busy || !value.trim()} onClick={submit}>
        {buttonLabel}
      </button>
    </div>
  );
}

// Full scorecard for one live innings (batting, extras, bowling, fall of wickets).
function InningsTables({ title, inn, strikerId, nonStrikerId, showCrease }) {
  const batting = inn.batting || [];
  const bowling = inn.bowling || [];
  const fow = inn.fallOfWickets || [];
  return (
    <div className="card" style={{ marginBottom: 16, padding: 0, overflow: "hidden" }}>
      <div style={{ background: "#334155", color: "#fff", padding: "10px 16px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, fontWeight: 700 }}>
        <span>{title}</span>
        <span>{inn.runs || 0}-{inn.wickets || 0} ({oversText(inn.legalBalls)} Ov) · RR {crrOf(inn.runs, inn.legalBalls)}</span>
      </div>

      <div className="table-responsive" style={{ border: "none", borderRadius: 0 }}>
        <table className="data-table">
          <thead>
            <tr><th>Batter</th><th>R(B)</th><th>4s</th><th>6s</th><th>SR</th></tr>
          </thead>
          <tbody>
            {batting.length === 0 && (
              <tr><td colSpan={5} style={{ color: "#94a3b8" }}>No batters recorded yet.</td></tr>
            )}
            {batting.map((b) => {
              const atCrease = showCrease && !b.isOut && (String(b.playerId) === String(strikerId) || String(b.playerId) === String(nonStrikerId));
              return (
                <tr key={b.playerId}>
                  <td>
                    <strong>{b.name}{String(b.playerId) === String(strikerId) && !b.isOut && showCrease ? " ★" : ""}</strong>
                    <div style={{ fontSize: 11, color: "#64748b" }}>
                      {b.isOut ? b.dismissalText || "out" : atCrease ? "batting" : "not out"}
                    </div>
                  </td>
                  <td>{b.runs}({b.balls})</td>
                  <td>{b.fours}</td>
                  <td>{b.sixes}</td>
                  <td>{srOf(b.runs, b.balls)}</td>
                </tr>
              );
            })}
            <tr>
              <td><strong>Extras</strong></td>
              <td colSpan={4}>{inn.extras || 0} <span style={{ color: "#64748b", fontSize: 12 }}>({extrasLine(inn)})</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="table-responsive" style={{ border: "none", borderRadius: 0, borderTop: "1px solid var(--border-subtle)" }}>
        <table className="data-table">
          <thead>
            <tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>NB</th><th>WD</th><th>ECO</th></tr>
          </thead>
          <tbody>
            {bowling.length === 0 && (
              <tr><td colSpan={8} style={{ color: "#94a3b8" }}>No bowlers recorded yet.</td></tr>
            )}
            {bowling.map((w) => (
              <tr key={w.playerId}>
                <td><strong>{w.name}</strong></td>
                <td>{oversText(w.legalBalls)}</td>
                <td>{w.maidens || 0}</td>
                <td>{w.runsConceded}</td>
                <td>{w.wickets}</td>
                <td>{w.noBalls || 0}</td>
                <td>{w.wides || 0}</td>
                <td>{crrOf(w.runsConceded, w.legalBalls)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {fow.length > 0 && (
        <div style={{ padding: "10px 16px", fontSize: 12, color: "#475569", borderTop: "1px solid var(--border-subtle)" }}>
          <strong>Fall of wickets: </strong>
          {fow.map((f) => `${f.runs}-${f.wicketNumber}${f.playerOutName ? ` (${f.playerOutName}, ${f.oversDisplay} ov)` : ""}`).join(" · ")}
        </div>
      )}
    </div>
  );
}

// Same layout for an archived (completed) innings, whose rows use the
// CompletedMatch snapshot shape.
function ArchivedTables({ title, card }) {
  const batting = card.batting || [];
  const bowling = card.bowling || [];
  const fow = card.fallOfWickets || [];
  const eb = card.extrasBreakdown || {};
  return (
    <div className="card" style={{ marginBottom: 16, padding: 0, overflow: "hidden" }}>
      <div style={{ background: "#334155", color: "#fff", padding: "10px 16px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, fontWeight: 700 }}>
        <span>{title}</span>
        <span>{card.runs || 0}-{card.wickets || 0} ({card.oversDisplay || "0.0"} Ov)</span>
      </div>

      <div className="table-responsive" style={{ border: "none", borderRadius: 0 }}>
        <table className="data-table">
          <thead>
            <tr><th>Batter</th><th>R(B)</th><th>4s</th><th>6s</th><th>SR</th></tr>
          </thead>
          <tbody>
            {batting.length === 0 && (
              <tr><td colSpan={5} style={{ color: "#94a3b8" }}>No batters recorded.</td></tr>
            )}
            {batting.map((b, i) => (
              <tr key={i}>
                <td>
                  <strong>{b.playerName}</strong>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{b.dismissal || "not out"}</div>
                </td>
                <td>{b.runs}({b.balls})</td>
                <td>{b.fours}</td>
                <td>{b.sixes}</td>
                <td>{srOf(b.runs, b.balls)}</td>
              </tr>
            ))}
            <tr>
              <td><strong>Extras</strong></td>
              <td colSpan={4}>
                {card.extras || 0}{" "}
                <span style={{ color: "#64748b", fontSize: 12 }}>
                  (Wd {eb.wides || 0} · NB {eb.noBalls || 0} · B {eb.byes || 0} · LB {eb.legByes || 0})
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="table-responsive" style={{ border: "none", borderRadius: 0, borderTop: "1px solid var(--border-subtle)" }}>
        <table className="data-table">
          <thead>
            <tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>NB</th><th>WD</th><th>ECO</th></tr>
          </thead>
          <tbody>
            {bowling.length === 0 && (
              <tr><td colSpan={8} style={{ color: "#94a3b8" }}>No bowlers recorded.</td></tr>
            )}
            {bowling.map((w, i) => (
              <tr key={i}>
                <td><strong>{w.playerName}</strong></td>
                <td>{w.overs}</td>
                <td>{w.maidens || 0}</td>
                <td>{w.runs}</td>
                <td>{w.wickets}</td>
                <td>{w.noBalls || 0}</td>
                <td>{w.wides || 0}</td>
                <td>{w.economy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {fow.length > 0 && (
        <div style={{ padding: "10px 16px", fontSize: 12, color: "#475569", borderTop: "1px solid var(--border-subtle)" }}>
          <strong>Fall of wickets: </strong>
          {fow.map((f) => `${f.runs}-${f.wicketNumber}${f.playerOutName ? ` (${f.playerOutName}, ${f.oversDisplay} ov)` : ""}`).join(" · ")}
        </div>
      )}
    </div>
  );
}

export default function LiveScoringConsole() {
  const { matchId } = useParams();
  const navigate = useNavigate();

  const [match, setMatch] = useState(null);
  const [matchType, setMatchType] = useState(null); // "LIVE" | "COMPLETED"
  const [ballEvents, setBallEvents] = useState([]);
  const [overs, setOvers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const [tossWinner, setTossWinner] = useState("Team A");
  const [tossDecision, setTossDecision] = useState("BAT");

  // Player-level scoring: when off, the console scores team totals only.
  const [trackPlayers, setTrackPlayers] = useState(true);
  const [changeBowler, setChangeBowler] = useState(false);
  const [wicketOpen, setWicketOpen] = useState(false);
  const [wk, setWk] = useState({ type: "Bowled", fielder: "", outWho: "striker", runs: 0 });
  const modeInitialised = useRef(false);

  const fetchMatch = useCallback(async () => {
    try {
      const data = await getLiveMatchDetails(matchId);
      if (data.success) {
        // A match already being scored as team totals only (no batters ever
        // recorded) keeps working that way instead of locking the pad.
        if (!modeInitialised.current) {
          modeInitialised.current = true;
          const st = data.match?.state;
          const cur = st?.currentInnings === 2 ? data.match?.score?.secondInnings : data.match?.score?.firstInnings;
          if (data.type !== "COMPLETED" && st?.status === "LIVE" && (cur?.legalBalls || 0) > 0 && !(cur?.batting || []).length) {
            setTrackPlayers(false);
          }
        }
        setMatch(data.match);
        setMatchType(data.type || "LIVE");
        setBallEvents(data.ballEvents || []);
        setOvers(data.overs || []);
        setError("");
      } else {
        setError(data.error || "Unable to load match.");
      }
    } catch (err) {
      setError(err.message || "Unable to load match.");
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    fetchMatch();

    const onUpdate = (payload) => {
      if (String(payload?._id) === String(matchId)) fetchMatch();
    };
    socket.on("match:scoreUpdated", onUpdate);
    socket.on("match:completed", onUpdate);
    return () => {
      socket.off("match:scoreUpdated", onUpdate);
      socket.off("match:completed", onUpdate);
    };
  }, [matchId, fetchMatch]);

  const d = useMemo(() => {
    if (!match) return null;
    const s = match.state || {};
    const blank = { runs: 0, wickets: 0, legalBalls: 0, extras: 0, batting: [], bowling: [], fallOfWickets: [] };
    const first = (match.score && match.score.firstInnings) || blank;
    const second = (match.score && match.score.secondInnings) || blank;

    const teamOf = (slot) => (slot === "Team A" ? match.teamA : slot === "Team B" ? match.teamB : null);
    const nameOf = (t, fb) => (t && (t.name || t.shortName)) || fb;

    // Who is batting now, and who batted first.
    const battingSlot = s.battingTeamId;
    const bowlingSlot = s.bowlingTeamId;
    const firstBattingSlot =
      (s.currentInnings === 2 ? bowlingSlot : battingSlot) || "Team A";
    const secondBattingSlot = firstBattingSlot === "Team A" ? "Team B" : "Team A";

    // The innings whose score should be the BIG number on screen.
    const onSecond = s.currentInnings === 2;
    const inn = onSecond ? second : first;
    const battingTeam = teamOf(onSecond ? secondBattingSlot : firstBattingSlot);

    const target = match.target;
    const chaseRuns = second.runs || 0;
    const runsNeeded = target ? Math.max(0, target - chaseRuns) : null;
    const ballsRemaining = match.overs * 6 - (second.legalBalls || 0);
    const rrr = target && ballsRemaining > 0 ? (runsNeeded / (ballsRemaining / 6)).toFixed(2) : null;

    // Crease: who is in, with their live figures.
    const rosterBat = teamOf(battingSlot)?.players || [];
    const rosterBowl = teamOf(bowlingSlot)?.players || [];
    const playerName = (roster, id) => roster.find((p) => String(p.playerId) === String(id) || String(p._id) === String(id))?.name || "";
    const batRow = (id) => (id ? (inn.batting || []).find((b) => String(b.playerId) === String(id)) : null);
    const bowlRow = (id) => (id ? (inn.bowling || []).find((b) => String(b.playerId) === String(id)) : null);
    const crease = (id, roster, row) => (id ? { id, name: row?.name || playerName(roster, id), row } : null);
    const striker = crease(s.strikerId, rosterBat, batRow(s.strikerId));
    const nonStriker = crease(s.nonStrikerId, rosterBat, batRow(s.nonStrikerId));
    const bowler = crease(s.bowlerId, rosterBowl, bowlRow(s.bowlerId));

    const atCrease = new Set([String(s.strikerId || ""), String(s.nonStrikerId || "")]);
    const outIds = new Set((inn.batting || []).filter((b) => b.isOut).map((b) => String(b.playerId)));
    const availableBatters = rosterBat.filter((p) => !atCrease.has(String(p.playerId)) && !outIds.has(String(p.playerId))).map((p) => p.name);
    const bowlerNames = rosterBowl.map((p) => p.name);
    const fielderNames = rosterBowl.map((p) => p.name);

    return {
      s, inn, first, second,
      firstTeamName: nameOf(teamOf(firstBattingSlot), "1st innings"),
      secondTeamName: nameOf(teamOf(secondBattingSlot), "2nd innings"),
      battingTeam, battingSlot, target, runsNeeded, ballsRemaining, rrr,
      striker, nonStriker, bowler, availableBatters, bowlerNames, fielderNames,
    };
  }, [match]);

  // Run a state/score call, refresh, and surface any error in the banner.
  async function run(fn, fallbackMsg, { reload = true } = {}) {
    if (actionLoading) return null;
    setActionLoading(true);
    setError("");
    try {
      const data = await fn();
      if (data && data.success === false) {
        setError(data.error || data.message || fallbackMsg);
      } else if (data?.match) {
        setMatch(data.match);
      }
      if (reload) await fetchMatch();
      return data;
    } catch (err) {
      setError(err.message || fallbackMsg);
      return null;
    } finally {
      setActionLoading(false);
    }
  }

  const score = (payload) => run(() => scoreLiveBall(matchId, payload), "Scoring failed.");
  const setState = (state, msg = "Could not update the match.") =>
    run(() => updateLiveMatchState(matchId, { state }), msg);

  async function handleUndo() {
    if (actionLoading || ballEvents.length === 0) return;
    if (!window.confirm("Undo the last ball? This will revert the score.")) return;
    await run(() => undoLiveBall(matchId), "Undo failed.");
  }

  async function handleStartMatch() {
    const battingTeam = tossDecision === "BAT" ? tossWinner : tossWinner === "Team A" ? "Team B" : "Team A";
    const bowlingTeam = battingTeam === "Team A" ? "Team B" : "Team A";
    await run(
      () =>
        updateLiveMatchState(matchId, {
          toss: { wonBy: tossWinner, decision: tossDecision },
          state: { status: "LIVE", battingTeamId: battingTeam, bowlingTeamId: bowlingTeam },
        }),
      "Unable to start match."
    );
  }

  const handleStartSecondInnings = () =>
    run(() => updateLiveMatchState(matchId, { state: { status: "LIVE" } }), "Unable to start the second innings.");

  async function handleEndInnings() {
    const second = d.s.currentInnings === 2;
    const msg = second
      ? "End the chase here? The result will be worked out from the current score."
      : "End this innings now? The next team will chase the current total.";
    if (!window.confirm(msg)) return;
    await run(() => endLiveInnings(matchId), "Could not end the innings.");
  }

  async function handleEndMatch() {
    if (!window.confirm("End this match and publish the result?")) return;
    setActionLoading(true);
    setError("");
    try {
      const data = await completeLiveMatch(matchId);
      if (data.success) navigate(-1);
      else setError(data.error || "Could not complete match.");
    } catch (err) {
      setError(err.message || "Could not complete match.");
    } finally {
      setActionLoading(false);
    }
  }

  async function confirmWicket() {
    const details = { type: wk.type };
    if (NEEDS_FIELDER.includes(wk.type) && wk.fielder.trim()) details.fielderName = wk.fielder.trim();
    if (wk.type === "Run Out" && d.s.strikerId) {
      details.dismissedPlayerId = wk.outWho === "nonStriker" ? d.s.nonStrikerId : d.s.strikerId;
    }
    setWicketOpen(false);
    await score({
      runs: wk.type === "Run Out" ? Number(wk.runs) || 0 : 0,
      isWicket: true,
      wicketDetails: details,
    });
    setWk({ type: "Bowled", fielder: "", outWho: "striker", runs: 0 });
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}>Loading match data...</div>;
  if (!match) return <div style={{ padding: 40, textAlign: "center" }}>{error || "Match not found."}</div>;

  // Archived match: a CompletedMatch document, not a LiveMatch. Its shape is
  // completely different (snapshot team names, `scorecards` instead of
  // `state`/`score`), and there is nothing left to score or undo — show a
  // read-only result summary instead of the live console.
  if (matchType === "COMPLETED") {
    const first = match.scorecards?.firstInnings || {};
    const second = match.scorecards?.secondInnings || {};
    const teamAName = match.teamA?.nameSnapshot || match.teamA?.shortNameSnapshot || "Team A";
    const teamBName = match.teamB?.nameSnapshot || match.teamB?.shortNameSnapshot || "Team B";

    return (
      <div style={{ padding: 20, maxWidth: 780, margin: "0 auto" }}>
        <button className="btn btn-outline" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
          <IconArrowLeft size={16} /> Back to Matches
        </button>

        {error && (
          <div className="alert-banner error" role="alert" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <h3 style={{ margin: 0 }}>{match.matchName}</h3>
            <span className="filter-pill active" style={{ backgroundColor: "#64748b", color: "#fff", border: "none" }}>
              COMPLETED
            </span>
          </div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
            {match.format} · {match.overs} Overs{match.venueSnapshot ? ` · ${match.venueSnapshot}` : ""}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16, background: "#eef8f0", color: "#157f3b", fontWeight: 700, textAlign: "center" }}>
          {match.resultText || (match.winner ? `${match.winner} won` : "Match completed")}
        </div>

        <ArchivedTables title={`${first.team || teamAName} innings`} card={first} />
        <ArchivedTables title={`${second.team || teamBName} innings`} card={second} />
      </div>
    );
  }

  const status = d.s.status;
  const awaitingBatter = Boolean(d.s.awaitingNewBatter);
  const awaitingBowler = Boolean(d.s.awaitingNewBowler);
  const creaseReady =
    !trackPlayers ||
    (Boolean(d.striker && d.nonStriker && d.bowler) && !awaitingBatter && !awaitingBowler);
  const canScore = !actionLoading && status === "LIVE" && creaseReady;

  const runBtn = (n, primary = false) => (
    <button
      key={n}
      className={`btn ${primary ? "btn-primary" : "btn-outline"}`}
      style={{ minWidth: 56, height: 56, fontSize: 20, fontWeight: 700 }}
      disabled={!canScore}
      onClick={() => score({ runs: n, isBoundary: n === 4 || n === 6 })}
    >
      {n}
    </button>
  );

  // The backend keeps a finished over's balls until the next delivery; once a
  // bowler has been chosen for the next over, start the strip afresh.
  const rawStrip = Array.isArray(d.s.thisOver) ? d.s.thisOver : [];
  const strikeLegal = rawStrip.filter((sym) => !/^(wd|nb)/i.test(sym)).length;
  const overStrip = strikeLegal >= 6 && !awaitingBowler ? [] : rawStrip;
  const oversForList = overs.filter(
    (o) => o.complete && o.innings === (status === "INNINGS_BREAK" ? 1 : d.s.currentInnings || 1)
  );
  const recentOvers = oversForList.slice(-6).reverse();

  // One batter row of the crease table (or the entry box for an empty end).
  const batterRow = (slot, who, key, nameKey) => {
    const onStrike = key === "striker";
    return (
      <tr key={key}>
        <td style={{ width: 28 }}>
          <input
            type="radio"
            name="strike"
            checked={onStrike}
            disabled={actionLoading || !who || !(d.striker && d.nonStriker)}
            onChange={() => !onStrike && setState({ swapStrike: true }, "Could not change strike.")}
            title={onStrike ? "On strike" : "Give strike"}
          />
        </td>
        <td>
          {who ? (
            <strong>{who.name || "Batter"}</strong>
          ) : (
            <NameEntry
              placeholder={awaitingBatter ? "Incoming batter" : slot}
              listId="batters-list"
              busy={actionLoading}
              onSubmit={(name) => setState({ [nameKey]: name }, "Could not set the batter.")}
            />
          )}
        </td>
        <td>{who?.row ? `${who.row.runs}(${who.row.balls})` : "0(0)"}</td>
        <td>{who?.row?.fours || 0}</td>
        <td>{who?.row?.sixes || 0}</td>
        <td>{who?.row ? srOf(who.row.runs, who.row.balls) : "0.00"}</td>
      </tr>
    );
  };

  return (
    <div style={{ padding: 20, maxWidth: 780, margin: "0 auto" }}>
      <button className="btn btn-outline" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
        <IconArrowLeft size={16} /> Back to Matches
      </button>

      {error && (
        <div className="alert-banner error" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      <datalist id="batters-list">{d.availableBatters.map((n) => <option key={n} value={n} />)}</datalist>
      <datalist id="bowlers-list">{d.bowlerNames.map((n) => <option key={n} value={n} />)}</datalist>
      <datalist id="fielders-list">{d.fielderNames.map((n) => <option key={n} value={n} />)}</datalist>

      {/* ================= TEAM SCORE ================= */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0 }}>{match.matchName}</h3>
          <span
            className="filter-pill active"
            style={{ backgroundColor: status === "LIVE" ? "#f43f5e" : "#64748b", color: "#fff", border: "none" }}
          >
            {status}
          </span>
        </div>

        {status === "INNINGS_BREAK" ? (
          <>
            {/* Innings break: the completed 1st innings is what matters */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 42, fontWeight: 800, lineHeight: 1 }}>
                {d.first.runs || 0}/{d.first.wickets || 0}
              </div>
              <div style={{ fontSize: 18, color: "#475569" }}>
                ({oversText(d.first.legalBalls)} / {match.overs} ov)
              </div>
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
              {d.firstTeamName} · 1st innings complete · CRR {crrOf(d.first.runs, d.first.legalBalls)} · Extras {d.first.extras || 0}
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 42, fontWeight: 800, lineHeight: 1 }}>
                {d.inn.runs || 0}/{d.inn.wickets || 0}
              </div>
              <div style={{ fontSize: 18, color: "#475569" }}>
                ({oversText(d.inn.legalBalls)} / {match.overs} ov)
              </div>
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
              {d.battingTeam ? (d.battingTeam.name || d.battingTeam.shortName) : (d.battingSlot || "Batting team")}
              {" batting"} · CRR {crrOf(d.inn.runs, d.inn.legalBalls)} · Extras {d.inn.extras || 0}
              {" · Innings "}{d.s.currentInnings || 1}
            </div>
          </>
        )}

        {d.s.currentInnings === 2 && d.target && status !== "INNINGS_BREAK" && (
          <div style={{ marginTop: 8, fontSize: 14, color: "#0f172a" }}>
            Chasing <strong>{d.target}</strong> ({d.firstTeamName} {d.first.runs}/{d.first.wickets})
            {d.runsNeeded > 0 ? (
              <> · need <strong>{d.runsNeeded}</strong> off <strong>{d.ballsRemaining}</strong>
                {d.rrr ? <> · RRR <strong>{d.rrr}</strong></> : null}</>
            ) : (
              <> · target reached</>
            )}
          </div>
        )}
      </div>

      {status === "COMPLETED" && (
        <div className="card" style={{ marginBottom: 16, background: "#eef8f0", color: "#157f3b", fontWeight: 700, textAlign: "center" }}>
          {match.resultText || `${match.winner || "Match"} — completed`}
        </div>
      )}

      {status === "INNINGS_BREAK" && (
        <div className="card" style={{ marginBottom: 16, background: "#fff8e1", color: "#92400e" }}>
          <strong>{d.firstTeamName} finished on {d.first.runs}/{d.first.wickets}</strong> ({oversText(d.first.legalBalls)} overs).
          {d.target ? <> {d.secondTeamName} need <strong>{d.target}</strong> to win.</> : null}
          <br />
          Press <strong>“Start 2nd Innings”</strong> below to score the chase, or <strong>“End Match”</strong> to finish.
        </div>
      )}

      {status === "UPCOMING" && (
        <div className="card" style={{ marginBottom: 16, background: "#eff6ff", color: "#1e40af" }}>
          Set the toss below and press <strong>“Start Match”</strong> to begin scoring.
        </div>
      )}

      {/* ================= BATTERS & BOWLER ================= */}
      {status === "LIVE" && trackPlayers && (
        <div className="card" style={{ marginBottom: 16, padding: 0, overflow: "hidden" }}>
          {awaitingBatter && (
            <div style={{ background: "#fff1f2", color: "#be123c", padding: "10px 16px", fontWeight: 700, fontSize: 14 }}>
              Wicket! Enter the incoming batter to continue scoring.
            </div>
          )}
          {awaitingBowler && !awaitingBatter && (
            <div style={{ background: "#fff8e1", color: "#92400e", padding: "10px 16px", fontWeight: 700, fontSize: 14 }}>
              Over complete — choose the bowler for the next over.
            </div>
          )}
          {!d.striker && !d.nonStriker && !d.bowler && !awaitingBatter && (
            <div style={{ background: "#eff6ff", color: "#1e40af", padding: "10px 16px", fontSize: 14 }}>
              Enter the two batters and the bowler to start scoring.
            </div>
          )}

          <div className="table-responsive" style={{ border: "none", borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr><th></th><th>Batting</th><th>R(B)</th><th>4s</th><th>6s</th><th>SR</th></tr>
              </thead>
              <tbody>
                {batterRow("Striker", d.striker, "striker", "strikerName")}
                {batterRow("Non-striker", d.nonStriker, "nonStriker", "nonStrikerName")}
              </tbody>
            </table>
          </div>

          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>Bowler</span>
            {d.bowler && !changeBowler && !awaitingBowler ? (
              <>
                <strong>{d.bowler.name || "Bowler"}</strong>
                <span style={{ fontSize: 13, color: "#475569" }}>
                  {oversText(d.bowler.row?.legalBalls || 0)} - {d.bowler.row?.maidens || 0} - {d.bowler.row?.runsConceded || 0} - {d.bowler.row?.wickets || 0}
                </span>
                <button className="btn btn-outline btn-sm" disabled={actionLoading} onClick={() => setChangeBowler(true)}>
                  Change
                </button>
              </>
            ) : (
              <NameEntry
                placeholder="Bowler name"
                listId="bowlers-list"
                busy={actionLoading}
                onSubmit={async (name) => {
                  await setState({ bowlerName: name }, "Could not set the bowler.");
                  setChangeBowler(false);
                }}
              />
            )}
            {d.striker && d.nonStriker && (
              <button
                className="btn btn-outline btn-sm"
                style={{ marginLeft: "auto" }}
                disabled={actionLoading}
                onClick={() => setState({ swapStrike: true }, "Could not change strike.")}
              >
                ⇄ Swap strike
              </button>
            )}
          </div>
        </div>
      )}

      {/* ================= SCORING PAD ================= */}
      {status === "LIVE" && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <h4 style={{ margin: 0 }}>Scoring — innings {d.s.currentInnings || 1}</h4>
            <label style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={!trackPlayers} onChange={(e) => setTrackPlayers(!e.target.checked)} />
              Score team total only (skip players)
            </label>
          </div>

          {/* This over */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", minHeight: 34, marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginRight: 4 }}>THIS OVER</span>
            {overStrip.length === 0 ? (
              <span style={{ fontSize: 12, color: "#94a3b8" }}>No balls yet</span>
            ) : (
              overStrip.map((sym, i) => <BallChip key={i} sym={sym} />)
            )}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {[0, 1, 2, 3].map((n) => runBtn(n))}
            {runBtn(4, true)}
            {runBtn(5)}
            {runBtn(6, true)}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn-outline" style={{ flex: 1, minWidth: 90, backgroundColor: "#fff8e1" }} disabled={!canScore} onClick={() => score({ runs: 0, extras: { type: "WD", runs: 1 } })}>Wide</button>
            <button className="btn btn-outline" style={{ flex: 1, minWidth: 90, backgroundColor: "#fff8e1" }} disabled={!canScore} onClick={() => score({ runs: 0, extras: { type: "NB", runs: 1 } })}>No Ball</button>
            <button className="btn btn-outline" style={{ flex: 1, minWidth: 90, backgroundColor: "#e3f2fd" }} disabled={!canScore} onClick={() => score({ runs: 0, extras: { type: "B", runs: 1 } })}>Bye</button>
            <button className="btn btn-outline" style={{ flex: 1, minWidth: 90, backgroundColor: "#e3f2fd" }} disabled={!canScore} onClick={() => score({ runs: 0, extras: { type: "LB", runs: 1 } })}>Leg Bye</button>
            <button className="btn btn-coral" style={{ flex: 1, minWidth: 90, color: "#fff" }} disabled={!canScore} onClick={() => setWicketOpen(true)}>Wicket</button>
          </div>

          {!creaseReady && (
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "10px 0 0" }}>
              Scoring unlocks once both batters and the bowler are set.
            </p>
          )}

          {/* Extras summary */}
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginTop: 14, padding: "10px 12px", background: "var(--bg-subtle)", borderRadius: 8, fontSize: 13 }}>
            <span><strong>Extras: {d.inn.extras || 0}</strong></span>
            <span>Wd: {d.inn.wides || 0}</span>
            <span>NB: {d.inn.noBalls || 0}</span>
            <span>B: {d.inn.byes || 0}</span>
            <span>LB: {d.inn.legByes || 0}</span>
          </div>
        </div>
      )}

      {/* ================= RECENT OVERS ================= */}
      {(status === "LIVE" || status === "INNINGS_BREAK") && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h4 style={{ margin: "0 0 10px" }}>Recent overs</h4>
          {recentOvers.length === 0 ? (
            <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>Completed overs will appear here.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {recentOvers.map((o) => (
                <div key={`${o.innings}-${o.over}`} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                  <span style={{ minWidth: 70, fontWeight: 700, fontSize: 13 }}>Over {o.over}</span>
                  <span style={{ minWidth: 80, fontSize: 12, color: "#64748b" }}>{o.bowler || "—"}</span>
                  <span style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {o.balls.map((sym, i) => <BallChip key={i} sym={sym} />)}
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700 }}>
                    {o.runs} run{o.runs === 1 ? "" : "s"}{o.wickets ? ` · ${o.wickets} wkt${o.wickets > 1 ? "s" : ""}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= MATCH CONTROLS ================= */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h4 style={{ margin: "0 0 12px" }}>Match controls</h4>

        {status === "UPCOMING" && (
          <div style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
            <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 600 }}>
              Toss winner
              <select value={tossWinner} onChange={(e) => setTossWinner(e.target.value)} disabled={actionLoading}>
                <option value="Team A">{match.teamA?.name || "Team A"}</option>
                <option value="Team B">{match.teamB?.name || "Team B"}</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 600 }}>
              Decision
              <select value={tossDecision} onChange={(e) => setTossDecision(e.target.value)} disabled={actionLoading}>
                <option value="BAT">Bat</option>
                <option value="BOWL">Bowl</option>
              </select>
            </label>
            <button className="btn btn-primary" disabled={actionLoading} onClick={handleStartMatch}>Start Match</button>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {status === "INNINGS_BREAK" && (
            <button className="btn btn-primary" disabled={actionLoading} onClick={handleStartSecondInnings}>
              Start 2nd Innings
            </button>
          )}

          {status === "LIVE" && (
            <button className="btn btn-outline" disabled={actionLoading} onClick={handleEndInnings}>
              End Innings
            </button>
          )}

          {status !== "UPCOMING" && status !== "COMPLETED" && (
            <button className="btn btn-outline" disabled={actionLoading} onClick={handleEndMatch}>
              End Match
            </button>
          )}
        </div>

        {status === "COMPLETED" && (
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>This match is complete.</p>
        )}
      </div>

      {/* ================= UNDO ================= */}
      <div className="card" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <button
          className="btn"
          style={{ background: "#f43f5e", color: "#fff", fontWeight: 700 }}
          disabled={actionLoading || ballEvents.length === 0}
          onClick={handleUndo}
        >
          ⟲ UNDO LAST BALL
        </button>
        <span style={{ fontSize: 12, color: "#94a3b8" }}>{ballEvents.length} deliveries recorded</span>
      </div>

      {/* ================= SCORE BOARD ================= */}
      {status !== "UPCOMING" && (
        <>
          <h3 style={{ margin: "8px 0 12px" }}>Score board</h3>
          {(d.first.legalBalls > 0 || (d.first.batting || []).length > 0) && (
            <InningsTables
              title={`${d.firstTeamName} innings`}
              inn={d.first}
              strikerId={d.s.currentInnings === 1 ? d.s.strikerId : null}
              nonStrikerId={d.s.currentInnings === 1 ? d.s.nonStrikerId : null}
              showCrease={status === "LIVE" && d.s.currentInnings === 1}
            />
          )}
          {(d.second.legalBalls > 0 || (d.second.batting || []).length > 0) && (
            <InningsTables
              title={`${d.secondTeamName} innings`}
              inn={d.second}
              strikerId={d.s.strikerId}
              nonStrikerId={d.s.nonStrikerId}
              showCrease={status === "LIVE" && d.s.currentInnings === 2}
            />
          )}
        </>
      )}

      {/* ================= WICKET DIALOG ================= */}
      <Modal isOpen={wicketOpen} onClose={() => setWicketOpen(false)} title="Wicket" maxWidth="440px">
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 8 }}>HOW WAS THE BATTER OUT?</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {OUT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`btn btn-sm ${wk.type === t ? "btn-coral" : "btn-outline"}`}
                  style={wk.type === t ? { color: "#fff" } : undefined}
                  onClick={() => setWk({ ...wk, type: t })}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {NEEDS_FIELDER.includes(wk.type) && (
            <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 600 }}>
              {wk.type === "Caught" ? "Caught by (leave blank for caught & bowled)" : wk.type === "Stumped" ? "Wicket-keeper" : "Fielder"}
              <input
                className="form-control"
                list="fielders-list"
                value={wk.fielder}
                placeholder="Fielder name (optional)"
                onChange={(e) => setWk({ ...wk, fielder: e.target.value })}
              />
            </label>
          )}

          {wk.type === "Run Out" && (
            <>
              {d.striker && d.nonStriker && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>WHO IS OUT?</div>
                  <div style={{ display: "flex", gap: 14 }}>
                    <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14 }}>
                      <input type="radio" checked={wk.outWho === "striker"} onChange={() => setWk({ ...wk, outWho: "striker" })} />
                      {d.striker.name} (striker)
                    </label>
                    <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14 }}>
                      <input type="radio" checked={wk.outWho === "nonStriker"} onChange={() => setWk({ ...wk, outWho: "nonStriker" })} />
                      {d.nonStriker.name}
                    </label>
                  </div>
                </div>
              )}
              <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 600 }}>
                Runs completed before the run out
                <select className="form-control" value={wk.runs} onChange={(e) => setWk({ ...wk, runs: e.target.value })}>
                  {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            </>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="btn btn-outline" onClick={() => setWicketOpen(false)}>Cancel</button>
            <button className="btn btn-coral" style={{ color: "#fff" }} disabled={actionLoading} onClick={confirmWicket}>
              Confirm wicket
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
