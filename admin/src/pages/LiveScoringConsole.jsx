import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { socket } from "../services/socket";
import { IconArrowLeft } from "../components/common/Icons";
import {
  getLiveMatchDetails,
  updateLiveMatchState,
  scoreLiveBall,
  undoLiveBall,
  completeLiveMatch,
} from "../services/api";

function oversText(legalBalls = 0) {
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
}

function crrOf(runs = 0, legalBalls = 0) {
  if (!legalBalls) return "0.00";
  return (runs / (legalBalls / 6)).toFixed(2);
}

export default function LiveScoringConsole() {
  const { matchId } = useParams();
  const navigate = useNavigate();

  const [match, setMatch] = useState(null);
  const [matchType, setMatchType] = useState(null); // "LIVE" | "COMPLETED"
  const [ballEvents, setBallEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const [tossWinner, setTossWinner] = useState("Team A");
  const [tossDecision, setTossDecision] = useState("BAT");

  const fetchMatch = useCallback(async () => {
    try {
      const data = await getLiveMatchDetails(matchId);
      if (data.success) {
        setMatch(data.match);
        setMatchType(data.type || "LIVE");
        setBallEvents(data.ballEvents || []);
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
    const blank = { runs: 0, wickets: 0, legalBalls: 0, extras: 0 };
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

    return {
      s, inn, first, second,
      firstTeamName: nameOf(teamOf(firstBattingSlot), "1st innings"),
      secondTeamName: nameOf(teamOf(secondBattingSlot), "2nd innings"),
      battingTeam, battingSlot, target, runsNeeded, ballsRemaining, rrr,
    };
  }, [match]);

  async function score(payload) {
    if (actionLoading) return;
    setActionLoading(true);
    setError("");
    try {
      const data = await scoreLiveBall(matchId, payload);
      if (data.success && data.match) setMatch(data.match);
      else setError(data.error || data.message || "Scoring failed.");
      await fetchMatch();
    } catch (err) {
      setError(err.message || "Scoring failed.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUndo() {
    if (actionLoading || ballEvents.length === 0) return;
    if (!window.confirm("Undo the last ball? This will revert the score.")) return;
    setActionLoading(true);
    setError("");
    try {
      const data = await undoLiveBall(matchId);
      if (data.success && data.match) setMatch(data.match);
      else if (!data.success) setError(data.error || "Undo failed.");
      await fetchMatch();
    } catch (err) {
      setError(err.message || "Undo failed.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStartMatch() {
    if (actionLoading) return;
    const battingTeam = tossDecision === "BAT" ? tossWinner : tossWinner === "Team A" ? "Team B" : "Team A";
    const bowlingTeam = battingTeam === "Team A" ? "Team B" : "Team A";
    setActionLoading(true);
    setError("");
    try {
      const data = await updateLiveMatchState(matchId, {
        toss: { wonBy: tossWinner, decision: tossDecision },
        state: { status: "LIVE", battingTeamId: battingTeam, bowlingTeamId: bowlingTeam },
      });
      if (data.success && data.match) setMatch(data.match);
      else setError(data.error || "Unable to start match.");
      await fetchMatch();
    } catch (err) {
      setError(err.message || "Unable to start match.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStartSecondInnings() {
    if (actionLoading) return;
    setActionLoading(true);
    setError("");
    try {
      const data = await updateLiveMatchState(matchId, { state: { status: "LIVE" } });
      if (data.success && data.match) setMatch(data.match);
      else setError(data.error || "Unable to start the second innings.");
      await fetchMatch();
    } catch (err) {
      setError(err.message || "Unable to start the second innings.");
    } finally {
      setActionLoading(false);
    }
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

    const inningsCard = (label, teamName, inn) => (
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.4 }}>
          {label}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 6, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0 }}>{inn.team || teamName}</h3>
          <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1 }}>
            {inn.runs || 0}/{inn.wickets || 0}
          </div>
          <div style={{ fontSize: 16, color: "#475569" }}>
            ({inn.oversDisplay || "0.0"} ov)
          </div>
        </div>
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Extras {inn.extras || 0}</div>
      </div>
    );

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

        {inningsCard("1st Innings", teamAName, first)}
        {inningsCard("2nd Innings", teamBName, second)}
      </div>
    );
  }

  const status = d.s.status;
  const canScore = !actionLoading && status === "LIVE";

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

      {/* ================= SCORING PAD ================= */}
      {status === "LIVE" && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h4 style={{ margin: "0 0 12px" }}>Scoring — innings {d.s.currentInnings || 1}</h4>

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
            <button className="btn btn-coral" style={{ flex: 1, minWidth: 90, color: "#fff" }} disabled={!canScore} onClick={() => score({ runs: 0, isWicket: true })}>Wicket</button>
          </div>
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

        {status === "INNINGS_BREAK" && (
          <button className="btn btn-primary" disabled={actionLoading} onClick={handleStartSecondInnings}>
            Start 2nd Innings
          </button>
        )}

        {status !== "UPCOMING" && status !== "COMPLETED" && (
          <button className="btn btn-outline" disabled={actionLoading} onClick={handleEndMatch} style={{ marginLeft: status === "INNINGS_BREAK" ? 8 : 0 }}>
            End Match
          </button>
        )}

        {status === "COMPLETED" && (
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>This match is complete.</p>
        )}
      </div>

      {/* ================= UNDO ================= */}
      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
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
    </div>
  );
}
