import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  MapPin,
  CalendarDays,
  RefreshCw,
  Radio,
  Trophy,
  Target,
  Activity,
} from "lucide-react";
import { getMatchScorecard } from "../services/api";
import { socket } from "../services/socket";
import Navbar from "../components/Navbar";

/* ---------------- helpers ---------------- */

function oversText(legalBalls = 0) {
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
}

function sr(runs = 0, balls = 0) {
  if (!balls) return "0.00";
  return ((runs / balls) * 100).toFixed(2);
}

function econ(runs = 0, legalBalls = 0) {
  if (!legalBalls) return "0.00";
  return (runs / (legalBalls / 6)).toFixed(2);
}

function crrOf(runs = 0, legalBalls = 0) {
  if (!legalBalls) return "0.00";
  return (runs / (legalBalls / 6)).toFixed(2);
}

function teamName(team, fallback) {
  return (
    team?.name ||
    team?.shortName ||
    team?.nameSnapshot ||
    team?.shortNameSnapshot ||
    fallback
  );
}

function fmtDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// Classify a delivery symbol (as produced by the backend "thisOver" strip:
// "•","1".."6","W","2+W","Wd","Wd2","Nb","Nb1","1B","2Lb", ...) for styling.
function ballKind(symRaw) {
  const sym = String(symRaw || "").trim();
  if (/^\d*\+?w$/i.test(sym)) return "wkt";
  if (/^wd/i.test(sym)) return "wide";
  if (/^nb/i.test(sym)) return "noball";
  if (/lb$/i.test(sym)) return "legbye";
  if (/b$/i.test(sym) && !/lb$/i.test(sym)) return "bye";
  if (sym === "6") return "six";
  if (sym === "4") return "four";
  if (sym === "•" || sym === "0") return "dot";
  return "run";
}

function ballLabel(symRaw) {
  const sym = String(symRaw || "").trim();
  if (sym === "•") return "0";
  return sym;
}

// Build a readable one-line "last ball" description from a BallEvent when
// commentary text isn't available.
function lastBallSentence(ball, lastWicketName) {
  if (!ball) return "";
  if (ball.isWicket) {
    const t = ball.wicket?.type ? ` (${ball.wicket.type})` : "";
    return lastWicketName ? `WICKET! ${lastWicketName}${t}` : `WICKET!${t}`;
  }
  const ex = ball.extras || {};
  if (ex.type === "WD") return ex.runs > 1 ? `WIDE + ${ex.runs - 1}` : "WIDE";
  if (ex.type === "NB") return ball.runsOffBat > 0 ? `NO BALL + ${ball.runsOffBat}` : "NO BALL";
  if (ex.type === "B") return `${ex.runs} BYE${ex.runs > 1 ? "S" : ""}`;
  if (ex.type === "LB") return `${ex.runs} LEG BYE${ex.runs > 1 ? "S" : ""}`;
  const r = ball.runsOffBat || 0;
  if (r === 6) return "SIX!";
  if (r === 4) return "FOUR!";
  if (r === 0) return "Dot ball";
  return `${r} run${r > 1 ? "s" : ""}`;
}

function topScorer(batting = []) {
  const played = batting.filter((b) => (b.runs || 0) > 0 || (b.balls || 0) > 0);
  if (played.length === 0) return null;
  return played.reduce((best, b) => (b.runs > (best?.runs ?? -1) ? b : best), null);
}

// Live rows use `runsConceded`/`legalBalls`; archived rows use `runs`/`overs`.
const runsAgainst = (b) => b.runsConceded ?? b.runs ?? 0;

function bestBowler(bowling = []) {
  const bowled = bowling.filter(
    (b) => (b.legalBalls || 0) > 0 || (b.wickets || 0) > 0 || (b.overs && b.overs !== "0.0")
  );
  if (bowled.length === 0) return null;
  return bowled.reduce((best, b) => {
    if (!best) return b;
    if ((b.wickets || 0) !== (best.wickets || 0)) return b.wickets > best.wickets ? b : best;
    return runsAgainst(b) < runsAgainst(best) ? b : best;
  }, null);
}

/* ---------------- shared bits ---------------- */

function OverStrip({ balls }) {
  if (!balls || balls.length === 0) return null;
  return (
    <div className="fyt-sc-over">
      <span className="fyt-sc-over-label">This over</span>
      <div className="fyt-sc-over-balls">
        {balls.map((b, i) => (
          <span key={i} className={`fyt-sc-ball is-${ballKind(b)}`}>
            {ballLabel(b)}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ text, tone = "live" }) {
  return <span className={`fyt-sc-statuspill is-${tone}`}>{text}</span>;
}

// "Wd 2 · NB 1 · B 3 · LB 0" — only the extras that actually happened.
function extrasBreakdownText(b = {}) {
  const parts = [
    ["Wd", b.wides],
    ["NB", b.noBalls],
    ["B", b.byes],
    ["LB", b.legByes],
  ].filter(([, n]) => n > 0);
  return parts.map(([label, n]) => `${label} ${n}`).join(" · ");
}

// Completed overs of the innings being played (or the one just finished),
// newest first. Built by the server from the recorded deliveries.
function RecentOvers({ overs = [], innings }) {
  const list = overs.filter((o) => o.complete && o.innings === innings).slice(-6).reverse();
  if (list.length === 0) return null;
  return (
    <div className="fyt-card fyt-sc-block">
      <h3 className="fyt-sc-h">Recent overs</h3>
      <div className="fyt-sc-ovlist">
        {list.map((o) => (
          <div key={`${o.innings}-${o.over}`} className="fyt-sc-ovrow">
            <div className="fyt-sc-ovhead">
              <strong>Over {o.over}</strong>
              {o.bowler && <span className="fyt-sc-dim">{o.bowler}</span>}
              <span className="fyt-sc-ovtotal">
                {o.runs} run{o.runs === 1 ? "" : "s"}
                {o.wickets ? ` · ${o.wickets} wkt${o.wickets > 1 ? "s" : ""}` : ""}
              </span>
            </div>
            <div className="fyt-sc-over-balls">
              {o.balls.map((b, i) => (
                <span key={i} className={`fyt-sc-ball is-${ballKind(b)}`}>{ballLabel(b)}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Full batting + bowling card for one live innings.
function LiveInningsCard({ title, inn, strikerId }) {
  const batting = inn.batting || [];
  const bowling = inn.bowling || [];
  if (batting.length === 0 && bowling.length === 0) return null;
  const breakdown = extrasBreakdownText({
    wides: inn.wides, noBalls: inn.noBalls, byes: inn.byes, legByes: inn.legByes,
  });
  return (
    <div className="fyt-card fyt-sc-block">
      <h3 className="fyt-sc-h">
        {title} — {inn.runs || 0}/{inn.wickets || 0} ({oversText(inn.legalBalls)} ov)
      </h3>
      {batting.length > 0 && (
        <div className="fyt-sc-tablewrap">
          <table className="fyt-sc-table">
            <thead>
              <tr><th>Batter</th><th></th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr>
            </thead>
            <tbody>
              {batting.map((b) => (
                <tr key={b.playerId}>
                  <td className="fyt-sc-td-name">
                    {b.name}
                    {strikerId && String(b.playerId) === String(strikerId) && !b.isOut ? " ★" : ""}
                  </td>
                  <td className="fyt-sc-td-dismissal">{b.isOut ? b.dismissalText : "not out"}</td>
                  <td className="fyt-sc-num">{b.runs}</td>
                  <td className="fyt-sc-num">{b.balls}</td>
                  <td className="fyt-sc-num">{b.fours}</td>
                  <td className="fyt-sc-num">{b.sixes}</td>
                  <td className="fyt-sc-num">{sr(b.runs, b.balls)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="fyt-sc-foot">
        Extras {inn.extras || 0}{breakdown ? ` (${breakdown})` : ""}
      </p>

      {bowling.length > 0 && (
        <>
          <h3 className="fyt-sc-h" style={{ marginTop: 16 }}>Bowling</h3>
          <div className="fyt-sc-tablewrap">
            <table className="fyt-sc-table">
              <thead>
                <tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>NB</th><th>WD</th><th>Econ</th></tr>
              </thead>
              <tbody>
                {bowling.map((b) => (
                  <tr key={b.playerId}>
                    <td className="fyt-sc-td-name">{b.name}</td>
                    <td className="fyt-sc-num">{oversText(b.legalBalls)}</td>
                    <td className="fyt-sc-num">{b.maidens || 0}</td>
                    <td className="fyt-sc-num">{b.runsConceded}</td>
                    <td className="fyt-sc-num">{b.wickets}</td>
                    <td className="fyt-sc-num">{b.noBalls || 0}</td>
                    <td className="fyt-sc-num">{b.wides || 0}</td>
                    <td className="fyt-sc-num">{econ(b.runsConceded, b.legalBalls)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- LIVE ---------------- */

function LiveScorecard({ match, ballEvents, overs = [] }) {
  const s = match.state || {};
  // At the innings break the backend has already flipped to "innings 2", but
  // nothing has been bowled in it yet — keep showing the finished 1st innings.
  const isBreak = s.status === "INNINGS_BREAK";
  const showFirst = isBreak || s.currentInnings !== 2;
  const inningsKey = showFirst ? "firstInnings" : "secondInnings";
  const inn =
    (match.score && match.score[inningsKey]) || {
      runs: 0, wickets: 0, legalBalls: 0, extras: 0, batting: [], bowling: [], fallOfWickets: [],
    };

  // The side whose innings is on screen (teams are already swapped at the break).
  const battingSlot = isBreak ? s.bowlingTeamId : s.battingTeamId;
  const battingTeam = battingSlot === "Team A" ? match.teamA : battingSlot === "Team B" ? match.teamB : null;

  const batting = inn.batting || [];
  const bowling = inn.bowling || [];
  const batStat = (id) => batting.find((b) => String(b.playerId) === String(id));
  const bowlStat = (id) => bowling.find((b) => String(b.playerId) === String(id));

  const striker = batStat(s.strikerId);
  const nonStriker = batStat(s.nonStrikerId);
  const bowler = bowlStat(s.bowlerId);
  const hasBatting = Boolean(striker || nonStriker);
  const hasBowling = Boolean(bowler);

  const fow = inn.fallOfWickets || [];
  const lastFow = fow[fow.length - 1];

  // This over: prefer the backend strip, else derive from ball events.
  let overStrip = Array.isArray(s.thisOver) ? s.thisOver : [];
  if (overStrip.length === 0 && ballEvents.length) {
    const thisInnings = ballEvents.filter((b) => b.innings === (showFirst ? 1 : 2));
    const lastOverNo = thisInnings.length ? thisInnings[thisInnings.length - 1].overNumber : null;
    overStrip = thisInnings
      .filter((b) => b.overNumber === lastOverNo)
      .map((b) =>
        b.isWicket ? "W"
        : b.extras?.type === "WD" ? "Wd"
        : b.extras?.type === "NB" ? "Nb"
        : b.extras?.type === "B" ? `${b.extras.runs}B`
        : b.extras?.type === "LB" ? `${b.extras.runs}Lb`
        : String(b.runsOffBat || 0)
      );
  }

  const lastBall = ballEvents.length ? ballEvents[ballEvents.length - 1] : null;
  const lastBallText =
    lastBallSentence(lastBall, lastFow?.playerOutName) ||
    (s.lastBallText ? String(s.lastBallText) : "");

  const target = match.target;
  const need = target ? Math.max(0, target - (inn.runs || 0)) : null;
  const ballsLeft = match.overs * 6 - (inn.legalBalls || 0);
  const rrr = target && ballsLeft > 0 ? (need / (ballsLeft / 6)).toFixed(2) : null;

  const inningsLabel = showFirst ? "1st Innings" : "2nd Innings";
  const statusText = isBreak ? "Innings Break" : inningsLabel;

  const aName = teamName(match.teamA, "Team A");
  const bName = teamName(match.teamB, "Team B");

  return (
    <>
      {/* ===== HERO ===== */}
      <div className="fyt-card fyt-sc-hero">
        <div className="fyt-sc-hero-top">
          <div className="fyt-sc-teams">
            <span>{aName}</span>
            <span className="fyt-sc-vs">vs</span>
            <span>{bName}</span>
          </div>
          <StatusPill text={isBreak ? "BREAK" : "LIVE"} tone={isBreak ? "break" : "live"} />
        </div>

        {(match.venue || match.scheduledAt) && (
          <div className="fyt-sc-meta">
            {match.venue && (
              <span><MapPin size={12} /> {match.venue}</span>
            )}
            {match.scheduledAt && (
              <span><CalendarDays size={12} /> {fmtDate(match.scheduledAt)}</span>
            )}
            <span>{match.format || "Cricket"} · {match.overs} ov</span>
          </div>
        )}

        {/* MAIN SCORE — most prominent */}
        <div className="fyt-sc-mainscore">
          <div className="fyt-sc-batteam">{teamName(battingTeam, "Batting")}</div>
          <div className="fyt-sc-bigline">
            <span className="fyt-sc-runs">{inn.runs || 0}</span>
            <span className="fyt-sc-slash">/</span>
            <span className="fyt-sc-wkts">{inn.wickets || 0}</span>
          </div>
          <div className="fyt-sc-subline">
            <strong>{oversText(inn.legalBalls)}</strong> overs
            <span className="fyt-sc-dotsep">•</span>
            CRR <strong>{crrOf(inn.runs, inn.legalBalls)}</strong>
          </div>
        </div>

        {/* TARGET SET (innings break) */}
        {isBreak && target && (
          <div className="fyt-sc-chase">
            <div className="fyt-sc-chase-row">
              <Target size={14} />
              <span>Target <strong>{target}</strong> in {match.overs} overs</span>
            </div>
          </div>
        )}

        {/* CHASE (2nd innings) */}
        {!isBreak && s.currentInnings === 2 && target && (
          <div className="fyt-sc-chase">
            <div className="fyt-sc-chase-row">
              <Target size={14} />
              <span>Target <strong>{target}</strong></span>
            </div>
            {need > 0 ? (
              <div className="fyt-sc-chase-need">
                Need <strong>{need}</strong> run{need === 1 ? "" : "s"} from <strong>{ballsLeft}</strong> ball{ballsLeft === 1 ? "" : "s"}
                {rrr && <> · RRR <strong>{rrr}</strong></>}
              </div>
            ) : (
              <div className="fyt-sc-chase-need">Target reached</div>
            )}
          </div>
        )}

        <div className="fyt-sc-statusbar">
          <Activity size={14} />
          <span>
            {match.resultText || `${statusText} · ${teamName(battingTeam, "Batting side")} batting`}
          </span>
        </div>
      </div>

      {/* ===== CREASE: batting + bowling (hide if no player data) ===== */}
      {(hasBatting || hasBowling) && (
        <div className="fyt-card fyt-sc-block">
          {hasBatting && (
            <>
              <h3 className="fyt-sc-h">Batting</h3>
              <div className="fyt-sc-crease">
                {striker && (
                  <div className="fyt-sc-batrow is-striker">
                    <span className="fyt-sc-name">
                      <span className="fyt-sc-star">★</span> {striker.name}
                    </span>
                    <span className="fyt-sc-rb">{striker.runs} <em>({striker.balls})</em></span>
                    <span className="fyt-sc-sr">SR {sr(striker.runs, striker.balls)}</span>
                  </div>
                )}
                {nonStriker && (
                  <div className="fyt-sc-batrow">
                    <span className="fyt-sc-name">{nonStriker.name}</span>
                    <span className="fyt-sc-rb">{nonStriker.runs} <em>({nonStriker.balls})</em></span>
                    <span className="fyt-sc-sr">SR {sr(nonStriker.runs, nonStriker.balls)}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {hasBowling && (
            <>
              <h3 className="fyt-sc-h" style={{ marginTop: hasBatting ? 16 : 0 }}>Bowling</h3>
              <div className="fyt-sc-crease">
                <div className="fyt-sc-batrow">
                  <span className="fyt-sc-name">{bowler.name}</span>
                  <span className="fyt-sc-rb" title="Overs - Maidens - Runs - Wickets">
                    {oversText(bowler.legalBalls)} - {bowler.maidens || 0} - {bowler.runsConceded} - {bowler.wickets}
                  </span>
                  <span className="fyt-sc-sr">Econ {econ(bowler.runsConceded, bowler.legalBalls)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== THIS OVER + LAST BALL ===== */}
      {(overStrip.length > 0 || lastBallText) && (
        <div className="fyt-card fyt-sc-block">
          <OverStrip balls={overStrip} />
          {lastBallText && (
            <div className="fyt-sc-lastball">
              <span className="fyt-sc-lastball-tag">Last ball</span>
              <span className="fyt-sc-lastball-text">{lastBallText}</span>
            </div>
          )}
        </div>
      )}

      {/* ===== WICKETS / FALL OF WICKETS ===== */}
      {fow.length > 0 && (
        <div className="fyt-card fyt-sc-block">
          <h3 className="fyt-sc-h">{fow.some((f) => f.playerOutName) ? "Wickets" : "Fall of wickets"}</h3>
          {lastFow && (
            <div className="fyt-sc-lastwkt">
              <Trophy size={14} />
              <span>
                {lastFow.playerOutName ? <strong>{lastFow.playerOutName} — </strong> : <strong>Wicket — </strong>}
                {lastFow.runs}/{lastFow.wicketNumber}
                {lastFow.oversDisplay ? <> ({lastFow.oversDisplay} ov)</> : null}
              </span>
            </div>
          )}
          {fow.length > 1 && (
            <div className="fyt-sc-fowlist">
              {fow.map((f) => (
                <span key={f.wicketNumber} className="fyt-sc-fowchip">
                  {f.runs}-{f.wicketNumber}
                  {f.playerOutName ? <em>{f.playerOutName}</em> : null}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== RECENT OVERS ===== */}
      <RecentOvers overs={overs} innings={isBreak ? 1 : s.currentInnings || 1} />

      {/* ===== SCORE BOARD: current innings first, then the earlier one ===== */}
      <LiveInningsCard
        title={`${teamName(battingTeam, "Batting")}${isBreak ? " (1st innings)" : ""}`}
        inn={inn}
        strikerId={isBreak ? null : s.strikerId}
      />
      {s.currentInnings === 2 && !isBreak && match.score?.firstInnings && (
        <LiveInningsCard
          title={`${teamName(battingSlot === "Team A" ? match.teamB : match.teamA, "1st innings")} (1st innings)`}
          inn={match.score.firstInnings}
          strikerId={null}
        />
      )}
    </>
  );
}

/* ---------------- COMPLETED ---------------- */

function CompletedInnings({ card }) {
  if (!card) return null;
  const batting = card.batting || [];
  const bowling = card.bowling || [];
  const fow = card.fallOfWickets || [];

  return (
    <div className="fyt-card fyt-sc-block">
      <div className="fyt-sc-inngshead">
        <h3 className="fyt-sc-h">{card.team}</h3>
        <strong>
          {card.runs}/{card.wickets}
          <span className="fyt-sc-dim"> ({card.oversDisplay || "0.0"} ov)</span>
        </strong>
      </div>

      {batting.length > 0 && (
        <div className="fyt-sc-tablewrap">
          <table className="fyt-sc-table">
            <thead>
              <tr><th>Batter</th><th></th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr>
            </thead>
            <tbody>
              {batting.map((b, i) => (
                <tr key={i}>
                  <td className="fyt-sc-td-name">{b.playerName}</td>
                  <td className="fyt-sc-td-dismissal">{b.dismissal}</td>
                  <td className="fyt-sc-num">{b.runs}</td>
                  <td className="fyt-sc-num">{b.balls}</td>
                  <td className="fyt-sc-num">{b.fours}</td>
                  <td className="fyt-sc-num">{b.sixes}</td>
                  <td className="fyt-sc-num">{sr(b.runs, b.balls)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="fyt-sc-foot">
        Extras {card.extras || 0}
        {extrasBreakdownText(card.extrasBreakdown) ? ` (${extrasBreakdownText(card.extrasBreakdown)})` : ""}
        {" · "}Total {card.runs}/{card.wickets}
      </p>

      {fow.length > 0 && (
        <div className="fyt-sc-fowlist">
          {fow.map((f, i) => (
            <span key={i} className="fyt-sc-fowchip">
              {f.runs}-{f.wicketNumber}
              <em>{f.playerOutName}</em>
            </span>
          ))}
        </div>
      )}

      {bowling.length > 0 && (
        <div className="fyt-sc-tablewrap" style={{ marginTop: 12 }}>
          <table className="fyt-sc-table">
            <thead>
              <tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>NB</th><th>WD</th><th>Econ</th></tr>
            </thead>
            <tbody>
              {bowling.map((b, i) => (
                <tr key={i}>
                  <td className="fyt-sc-td-name">{b.playerName}</td>
                  <td className="fyt-sc-num">{b.overs}</td>
                  <td className="fyt-sc-num">{b.maidens ?? "-"}</td>
                  <td className="fyt-sc-num">{b.runs}</td>
                  <td className="fyt-sc-num">{b.wickets}</td>
                  <td className="fyt-sc-num">{b.noBalls ?? "-"}</td>
                  <td className="fyt-sc-num">{b.wides ?? "-"}</td>
                  <td className="fyt-sc-num">{b.economy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CompletedScorecard({ match }) {
  const cards = match.scorecards || {};
  const first = cards.firstInnings || {};
  const second = cards.secondInnings || {};
  const hasDetail =
    (first.batting || []).length > 0 || (second.batting || []).length > 0;

  // top scorer / best bowler per innings
  const firstTop = topScorer(first.batting || []);
  const secondTop = topScorer(second.batting || []);
  const firstBest = bestBowler(first.bowling || []);
  const secondBest = bestBowler(second.bowling || []);

  const aName = first.team || teamName(match.teamA, "Team A");
  const bName = second.team || teamName(match.teamB, "Team B");

  return (
    <>
      <div className="fyt-card fyt-sc-hero">
        <div className="fyt-sc-hero-top">
          <div className="fyt-sc-teams">
            <span>{aName}</span>
            <span className="fyt-sc-vs">vs</span>
            <span>{bName}</span>
          </div>
          <StatusPill text="RESULT" tone="done" />
        </div>

        {(match.venueSnapshot || match.scheduledAt) && (
          <div className="fyt-sc-meta">
            {match.venueSnapshot && (<span><MapPin size={12} /> {match.venueSnapshot}</span>)}
            {match.scheduledAt && (<span><CalendarDays size={12} /> {fmtDate(match.scheduledAt)}</span>)}
            <span>{match.format || "Cricket"} · {match.overs} ov</span>
          </div>
        )}

        <div className="fyt-sc-resultbox">
          <div className="fyt-sc-resrow">
            <span className="fyt-sc-resteam">{aName}</span>
            <span className="fyt-sc-resscore">
              {first.runs || 0}/{first.wickets || 0}
              <em> ({first.oversDisplay || "0.0"})</em>
            </span>
          </div>
          <div className="fyt-sc-resrow">
            <span className="fyt-sc-resteam">{bName}</span>
            <span className="fyt-sc-resscore">
              {second.runs || 0}/{second.wickets || 0}
              <em> ({second.oversDisplay || "0.0"})</em>
            </span>
          </div>
        </div>

        <div className="fyt-sc-statusbar is-done">
          <Trophy size={14} />
          <span>{match.resultText || (match.winner ? `${match.winner} won` : "Match completed")}</span>
        </div>
      </div>

      {/* Highlights */}
      {(firstTop || secondTop || firstBest || secondBest) && (
        <div className="fyt-card fyt-sc-block">
          <h3 className="fyt-sc-h">Highlights</h3>
          <div className="fyt-sc-hl">
            {firstTop && (
              <div className="fyt-sc-hl-item">
                <span className="fyt-sc-hl-label">Top scorer · {first.team || aName}</span>
                <strong>{firstTop.playerName} {firstTop.runs} ({firstTop.balls})</strong>
              </div>
            )}
            {secondTop && (
              <div className="fyt-sc-hl-item">
                <span className="fyt-sc-hl-label">Top scorer · {second.team || bName}</span>
                <strong>{secondTop.playerName} {secondTop.runs} ({secondTop.balls})</strong>
              </div>
            )}
            {firstBest && (
              <div className="fyt-sc-hl-item">
                <span className="fyt-sc-hl-label">Best bowler · {first.team || aName}</span>
                <strong>{firstBest.playerName} {firstBest.wickets}/{runsAgainst(firstBest)}</strong>
              </div>
            )}
            {secondBest && (
              <div className="fyt-sc-hl-item">
                <span className="fyt-sc-hl-label">Best bowler · {second.team || bName}</span>
                <strong>{secondBest.playerName} {secondBest.wickets}/{runsAgainst(secondBest)}</strong>
              </div>
            )}
          </div>
        </div>
      )}

      {hasDetail && (
        <>
          <CompletedInnings card={first} />
          <CompletedInnings card={second} />
        </>
      )}
    </>
  );
}

/* ---------------- CONTAINER ---------------- */

export default function PublicMatchScorecard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [type, setType] = useState(null);
  const [match, setMatch] = useState(null);
  const [ballEvents, setBallEvents] = useState([]);
  const [overs, setOvers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const data = await getMatchScorecard(id);
      setType(data.type);
      setMatch(data.match);
      setBallEvents(Array.isArray(data.ballEvents) ? data.ballEvents : []);
      setOvers(Array.isArray(data.overs) ? data.overs : []);
    } catch (err) {
      setError(err.message || "Unable to load scorecard.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();

    const isThisMatch = (payload) =>
      payload &&
      (String(payload._id) === String(id) ||
        String(payload.sourceMatchId) === String(id) ||
        String(payload.liveMatchId) === String(id));

    const refresh = (payload) => {
      if (payload && payload._id && !isThisMatch(payload)) return;
      load();
    };
    const onDeleted = (payload) => {
      if (isThisMatch(payload)) {
        setMatch(null);
        setType(null);
        setError("This match has been removed by the organiser.");
      }
    };
    socket.on("match:scoreUpdated", refresh);
    socket.on("match:updated", refresh);
    socket.on("match:completed", refresh);
    socket.on("new-live-match", refresh);
    socket.on("match:deleted", onDeleted);
    return () => {
      socket.off("match:scoreUpdated", refresh);
      socket.off("match:updated", refresh);
      socket.off("match:completed", refresh);
      socket.off("new-live-match", refresh);
      socket.off("match:deleted", onDeleted);
    };
  }, [id, load]);

  if (loading) {
    return (
      <div className="fyt-app-shell">
        <Navbar />
        <main className="fyt-main-content">
          <div className="fyt-container" style={{ padding: "60px 16px", textAlign: "center" }}>
            <div className="fyt-loading-spinner" />
            <p style={{ marginTop: 16, color: "var(--text-secondary)" }}>Loading live scorecard...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="fyt-app-shell">
        <Navbar />
        <main className="fyt-main-content">
          <div className="fyt-container" style={{ padding: "60px 16px", textAlign: "center" }}>
            <h2>Match Not Found</h2>
            <p style={{ color: "var(--text-secondary)", margin: "12px 0 24px" }}>
              {error || "This match scorecard is not available."}
            </p>
            <button className="fyt-btn-primary" onClick={load}>
              <RefreshCw size={15} style={{ marginRight: 6 }} /> Try Again
            </button>
          </div>
        </main>
      </div>
    );
  }

  const isCompleted = type === "COMPLETED" || (!match.state && match.scorecards);

  return (
    <div className="fyt-app-shell">
      <Navbar />
      <main className="fyt-main-content" style={{ paddingBottom: 60 }}>
        <div className="fyt-container fyt-sc-page">
          <div className="fyt-td-nav-bar">
            <button className="fyt-back-btn" onClick={() => navigate(-1)} aria-label="Go Back">
              <ArrowLeft size={18} />
              <span>Back to Matches</span>
            </button>
            <div className="fyt-scorecard-live-tag">
              <Radio size={14} />
              <span>{isCompleted ? "RESULT" : (match.state?.status || "LIVE")}</span>
            </div>
          </div>

          {isCompleted ? (
            <CompletedScorecard match={match} />
          ) : (
            <LiveScorecard match={match} ballEvents={ballEvents} overs={overs} />
          )}
        </div>
      </main>
    </div>
  );
}
