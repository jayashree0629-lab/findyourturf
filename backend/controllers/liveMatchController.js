const mongoose = require("mongoose");
const LiveMatch = require("../models/LiveMatch");
const BallEvent = require("../models/BallEvent");
const CompletedMatch = require("../models/CompletedMatch");

// --- UTILITY FUNCTIONS ---
function emitToRoom(req, matchId, eventName, data) {
  const io = req.app.get("io");
  if (!io) return;

  // Room-scoped emit (kept for the single-match detail view).
  io.to(`match:${matchId}`).emit(eventName, data);

  // The public Live page does not join any room, so also broadcast
  // score/state/lifecycle events to every connected client.
  if (matchId === "global") {
    io.emit(eventName, data);
  }
}

// Map a live LiveMatch team ({name, shortName, ...}) onto the
// CompletedMatch team snapshot shape ({nameSnapshot, ...}).
function snapshotTeam(team) {
  if (!team) return {};
  return {
    teamId: team._id ? String(team._id) : undefined,
    nameSnapshot: team.name || "",
    shortNameSnapshot: team.shortName || "",
    logoSnapshot: team.logo || "",
    players: (team.players || []).map((p) => ({
      originalPlayerId: p.playerId || (p._id ? String(p._id) : undefined),
      nameSnapshot: p.name || "",
      roleSnapshot: p.role || "",
      jerseyNumberSnapshot: p.jerseyNumber || "",
    })),
  };
}

function cloneValue(value) {
  if (!value) return value;
  return typeof value.toObject === "function"
    ? value.toObject()
    : JSON.parse(JSON.stringify(value));
}

function oversDisplay(legalBalls = 0) {
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
}

function teamNameFor(match, slot) {
  const team = slot === "Team A" ? match.teamA : slot === "Team B" ? match.teamB : null;
  return team?.name || team?.shortName || slot || "Team";
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

// ---------------------------------------------------------------------------
// PLAYER-STAT HELPERS
// Per-player stats live inside match.score.<innings>.batting / .bowling and the
// current striker/non-striker/bowler ids live in match.state. Both containers
// are snapshotted by BallEvent.previousScore / previousState in scoreBall and
// restored by undoLastBall, so nothing here needs its own undo path.
// ---------------------------------------------------------------------------

function teamForSlot(match, slot) {
  return slot === "Team A" ? match.teamA : slot === "Team B" ? match.teamB : null;
}

function rosterFor(match, slot) {
  const team = teamForSlot(match, slot);
  return (team && Array.isArray(team.players)) ? team.players : [];
}

function findRosterPlayer(match, slot, playerId) {
  if (!playerId) return null;
  const wanted = String(playerId);
  return rosterFor(match, slot).find(
    (p) => String(p.playerId) === wanted || String(p._id) === wanted
  ) || null;
}

function findRosterPlayerByName(match, slot, name) {
  const clean = cleanText(name).toLowerCase();
  if (!clean) return null;
  return rosterFor(match, slot).find(
    (p) => String(p.name || "").trim().toLowerCase() === clean
  ) || null;
}

// Resolve a typed name to a roster playerId, REGISTERING a new match player for
// that team when the name is not already on the roster (e.g. the match was
// created without a squad). Never creates a duplicate for a name that already
// exists (case-insensitive). Returns { id, created } or null for an empty name.
function resolveOrCreateRosterPlayer(match, slot, name) {
  const team = teamForSlot(match, slot);
  const clean = cleanText(name);
  if (!team || !clean) return null;

  const existing = findRosterPlayerByName(match, slot, clean);
  if (existing) {
    return { id: String(existing.playerId || existing._id), created: false };
  }

  team.players.push({ name: clean });
  const added = team.players[team.players.length - 1];
  match.markModified(slot === "Team A" ? "teamA" : "teamB");
  return { id: String(added.playerId || added._id), created: true };
}

function rosterPlayerName(match, slot, playerId, fallback = "") {
  const p = findRosterPlayer(match, slot, playerId);
  return p?.name || fallback || "";
}

// Find or lazily create the batting-card row for a player.
function ensureBatter(inningsScore, match, battingSlot, playerId) {
  if (!playerId) return null;
  const wanted = String(playerId);
  let row = inningsScore.batting.find((b) => String(b.playerId) === wanted);
  if (!row) {
    inningsScore.batting.push({
      playerId: wanted,
      name: rosterPlayerName(match, battingSlot, wanted, "Batter"),
      battingOrder: inningsScore.batting.length + 1,
      dismissalText: "not out",
    });
    row = inningsScore.batting[inningsScore.batting.length - 1];
  }
  return row;
}

// Find or lazily create the bowling-card row for a player.
function ensureBowler(inningsScore, match, bowlingSlot, playerId) {
  if (!playerId) return null;
  const wanted = String(playerId);
  let row = inningsScore.bowling.find((b) => String(b.playerId) === wanted);
  if (!row) {
    inningsScore.bowling.push({
      playerId: wanted,
      name: rosterPlayerName(match, bowlingSlot, wanted, "Bowler"),
    });
    row = inningsScore.bowling[inningsScore.bowling.length - 1];
  }
  return row;
}

// Dismissals credited to the bowler in the bowling figures.
function bowlerCreditedWicket(type) {
  return ["Bowled", "Caught", "LBW", "Stumped", "Hit Wicket"].includes(type);
}

function buildDismissalText(type, bowlerName, fielderName) {
  const b = bowlerName || "";
  const f = fielderName || "";
  switch (type) {
    case "Bowled": return b ? `b ${b}` : "bowled";
    case "LBW": return b ? `lbw b ${b}` : "lbw";
    case "Caught": return `c ${f || "fielder"}${b ? ` b ${b}` : ""}`;
    case "Stumped": return `st ${f || "keeper"}${b ? ` b ${b}` : ""}`;
    case "Hit Wicket": return b ? `hit wicket b ${b}` : "hit wicket";
    case "Run Out": return f ? `run out (${f})` : "run out";
    case "Retired": return "retired";
    default: return type ? String(type).toLowerCase() : "out";
  }
}

// Map a live innings (runs/wickets/legalBalls + batting[]/bowling[]) onto the
// CompletedMatch scorecard shape. Safe on legacy matches with empty arrays.
function snapshotInnings(teamName, innings) {
  const legalBalls = innings?.legalBalls || 0;
  const batting = (innings?.batting || []).map((b) => ({
    playerName: b.name || "",
    runs: b.runs || 0,
    balls: b.balls || 0,
    fours: b.fours || 0,
    sixes: b.sixes || 0,
    dismissal: b.isOut ? (b.dismissalText || "out") : "not out",
  }));
  const bowling = (innings?.bowling || []).map((w) => {
    const balls = w.legalBalls || 0;
    const oversNum = balls / 6;
    return {
      playerName: w.name || "",
      overs: oversDisplay(balls),
      runs: w.runsConceded || 0,
      wickets: w.wickets || 0,
      economy: oversNum > 0 ? ((w.runsConceded || 0) / oversNum).toFixed(2) : "0.00",
    };
  });
  const fallOfWickets = (innings?.fallOfWickets || []).map((f) => ({
    wicketNumber: f.wicketNumber,
    runs: f.runs || 0,
    oversDisplay: f.oversDisplay || "0.0",
    playerOutName: f.playerOutName || "",
  }));
  return {
    team: teamName,
    runs: innings?.runs || 0,
    wickets: innings?.wickets || 0,
    oversDisplay: oversDisplay(legalBalls),
    extras: innings?.extras || 0,
    batting,
    bowling,
    fallOfWickets,
  };
}

async function archiveCompletedMatch(match) {
  const ballEvents = await BallEvent.find({ matchId: match._id }).sort({ sequenceNumber: 1 });
  const firstBattingTeam = match.state?.currentInnings === 2
    ? match.state?.bowlingTeamId
    : match.state?.battingTeamId;
  const secondBattingTeam = firstBattingTeam === "Team A" ? "Team B" : "Team A";
  const scorecards = {
    firstInnings: snapshotInnings(teamNameFor(match, firstBattingTeam), match.score.firstInnings),
    secondInnings: snapshotInnings(teamNameFor(match, secondBattingTeam), match.score.secondInnings),
  };

  const ballHistory = ballEvents.map((ball) => ({
    innings: ball.innings,
    overNumber: ball.overNumber,
    ballNumber: ball.ballNumber,
    strikerName: ball.strikerId || "",
    bowlerName: ball.bowlerId || "",
    summary: ball.isWicket
      ? "W"
      : ball.extras?.type
        ? `${ball.extras.type}${ball.extras.runs || ""}`
        : String(ball.runsOffBat || 0),
  }));

  return CompletedMatch.findOneAndUpdate(
    { sourceMatchId: match._id },
    {
      $setOnInsert: {
        sourceMatchId: match._id,
        tournamentId: match.tournamentId,
        matchName: match.matchName,
        sport: match.sport,
        format: match.format,
        overs: match.overs,
        venueSnapshot: match.venue || "",
        scheduledAt: match.scheduledAt,
        startedAt: match.startedAt || match.updatedAt || match.createdAt,
        teamA: snapshotTeam(match.teamA),
        teamB: snapshotTeam(match.teamB),
        toss: match.toss,
      },
      $set: {
        winner: match.winner,
        resultText: match.resultText,
        scorecards,
        ballHistory,
        completedAt: new Date(),
      },
    },
    { new: true, upsert: true, runValidators: true }
  );
}

// --- ADMIN CONTROLLERS ---

exports.createMatch = async (req, res) => {
  try {
    const {
      tournamentId,
      matchName,
      format,
      overs,
      venue,
      scheduledAt,
      teamA,
      teamB
    } = req.body;

    const normalizedMatchName = cleanText(matchName);
    const normalizedFormat = cleanText(format);
    const normalizedVenue = cleanText(venue);
    const normalizedTeamA = {
      ...(teamA || {}),
      name: cleanText(teamA?.name),
      shortName: cleanText(teamA?.shortName),
      players: Array.isArray(teamA?.players) ? teamA.players : [],
    };
    const normalizedTeamB = {
      ...(teamB || {}),
      name: cleanText(teamB?.name),
      shortName: cleanText(teamB?.shortName),
      players: Array.isArray(teamB?.players) ? teamB.players : [],
    };
    const parsedOvers = Number(overs);
    const parsedScheduledAt = new Date(scheduledAt);

    if (!normalizedMatchName || normalizedMatchName.length > 120 || !normalizedFormat ||
      !Number.isSafeInteger(parsedOvers) || parsedOvers < 1 || parsedOvers > 100 ||
      !scheduledAt || Number.isNaN(parsedScheduledAt.getTime()) ||
      !normalizedTeamA.name || !normalizedTeamA.shortName ||
      !normalizedTeamB.name || !normalizedTeamB.shortName) {
      return res.status(400).json({ success: false, message: "Enter a match name, format, overs from 1 to 100, valid schedule, and both teams." });
    }

    if (normalizedTeamA.name.toLowerCase() === normalizedTeamB.name.toLowerCase()) {
      return res.status(400).json({ success: false, message: "Team A and Team B must be different teams." });
    }

    if (normalizedTeamA.shortName.toLowerCase() === normalizedTeamB.shortName.toLowerCase()) {
      return res.status(400).json({ success: false, message: "Team short names must be different." });
    }

    const normalizedTournamentId = cleanText(tournamentId);
    if (normalizedTournamentId && !mongoose.Types.ObjectId.isValid(normalizedTournamentId)) {
      return res.status(400).json({ success: false, message: "The selected tournament is invalid." });
    }

    const match = new LiveMatch({
      ...(normalizedTournamentId ? { tournamentId: normalizedTournamentId } : {}),
      matchName: normalizedMatchName,
      format: normalizedFormat,
      overs: parsedOvers,
      venue: normalizedVenue,
      scheduledAt: parsedScheduledAt,
      teamA: normalizedTeamA,
      teamB: normalizedTeamB,
      startedAt: null,
      state: {
        status: "UPCOMING",
        currentInnings: 1,
      }
    });

    await match.save();
    emitToRoom(req, "global", "new-live-match", match);
    res.status(201).json({ success: true, match });
  } catch (err) {
    const status = err?.name === "ValidationError" || err?.name === "CastError" ? 400 : 500;
    res.status(status).json({
      success: false,
      message: status === 500 ? "Unable to assign the match right now." : err.message,
      error: err.message,
    });
  }
};

exports.getAdminMatches = async (req, res) => {
  try {
    const active = await LiveMatch.find({
      "state.status": { $ne: "COMPLETED" },
    }).sort({ createdAt: -1 });
    const completed = await CompletedMatch.find().sort({ completedAt: -1 });
    res.json({ success: true, active, completed });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getMatchDetails = async (req, res) => {
  try {
    const match = await LiveMatch.findById(req.params.id);
    if (match) {
      const ballEvents = await BallEvent.find({ matchId: match._id }).sort({ sequenceNumber: 1 });
      return res.json({ success: true, type: "LIVE", match, ballEvents });
    }

    // Not a live match — the admin "Completed" tab lists archived matches by
    // their own CompletedMatch._id, which never exists in LiveMatch (either
    // it was deleted on "End Match", or it never had a matching id at all
    // since the archive gets its own _id). Fall back to the archive, the
    // same way the public scorecard endpoint already does.
    const completedMatch =
      (await CompletedMatch.findById(req.params.id).catch(() => null)) ||
      (await CompletedMatch.findOne({ sourceMatchId: req.params.id }).catch(() => null));

    if (completedMatch) {
      return res.json({ success: true, type: "COMPLETED", match: completedMatch, ballEvents: [] });
    }

    res.status(404).json({ success: false, error: "Match not found" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateMatchState = async (req, res) => {
  try {
    const match = await LiveMatch.findById(req.params.id);
    if (!match) return res.status(404).json({ success: false, error: "Match not found" });

    const { toss, state, score } = req.body;
    if (match.state.status === "COMPLETED" || match.state.status === "CANCELLED") {
      return res.status(400).json({ success: false, error: "This match can no longer be changed" });
    }
    if (state?.status && !["UPCOMING", "LIVE", "INNINGS_BREAK"].includes(state.status)) {
      return res.status(400).json({ success: false, error: "Invalid live match status" });
    }
    if (toss && (!['Team A', 'Team B'].includes(toss.wonBy) || !['BAT', 'BOWL'].includes(toss.decision))) {
      return res.status(400).json({ success: false, error: "A valid toss winner and decision are required" });
    }
    if (toss) match.toss = toss;
    if (state) {
      if (state.battingTeamId && !["Team A", "Team B"].includes(state.battingTeamId)) {
        return res.status(400).json({ success: false, error: "Invalid batting team" });
      }
      if (state.bowlingTeamId && !["Team A", "Team B"].includes(state.bowlingTeamId)) {
        return res.status(400).json({ success: false, error: "Invalid bowling team" });
      }

      // Merge the simple pass-through fields explicitly (safer than spreading a
      // Mongoose nested path and keeps client from writing internal fields).
      if (state.status !== undefined) match.state.status = state.status;
      if (state.currentInnings !== undefined) match.state.currentInnings = state.currentInnings;
      if (state.battingTeamId !== undefined) match.state.battingTeamId = state.battingTeamId;
      if (state.bowlingTeamId !== undefined) match.state.bowlingTeamId = state.bowlingTeamId;

      const inningsScore =
        match.state.currentInnings === 2 ? match.score.secondInnings : match.score.firstInnings;
      const battingSlot = match.state.battingTeamId;
      const bowlingSlot = match.state.bowlingTeamId;

      // Resolve a striker / non-striker / bowler assignment. Accepts either a
      // typed NAME (matched against the roster, or registered as a new match
      // player when the roster has no such name) or an existing playerId.
      const resolveAssignment = (nameKey, idKey, slot) => {
        if (state[nameKey] !== undefined && cleanText(state[nameKey])) {
          const r = resolveOrCreateRosterPlayer(match, slot, state[nameKey]);
          return r ? r.id : null;
        }
        if (state[idKey] !== undefined) {
          const id = state[idKey] ? String(state[idKey]) : null;
          if (id && !findRosterPlayer(match, slot, id)) return { error: "not-in-team" };
          return id;
        }
        return "skip";
      };

      // --- Striker / non-striker selection ---
      for (const [nameKey, idKey] of [
        ["strikerName", "strikerId"],
        ["nonStrikerName", "nonStrikerId"],
      ]) {
        const resolved = resolveAssignment(nameKey, idKey, battingSlot);
        if (resolved === "skip") continue;
        if (resolved && resolved.error === "not-in-team") {
          return res.status(400).json({ success: false, error: "That batter is not in the batting team." });
        }
        const id = resolved || null;
        if (id) {
          const existing = inningsScore.batting.find((b) => String(b.playerId) === id);
          if (existing && existing.isOut) {
            return res.status(400).json({ success: false, error: "That batter is already out." });
          }
          const other = idKey === "strikerId" ? match.state.nonStrikerId : match.state.strikerId;
          if (other && String(other) === id) {
            return res.status(400).json({ success: false, error: "Striker and non-striker must be different players." });
          }
        }
        match.state[idKey] = id;
        if (id) ensureBatter(inningsScore, match, battingSlot, id);
      }

      // --- Bowler selection ---
      {
        const resolved = resolveAssignment("bowlerName", "bowlerId", bowlingSlot);
        if (resolved !== "skip") {
          if (resolved && resolved.error === "not-in-team") {
            return res.status(400).json({ success: false, error: "That bowler is not in the bowling team." });
          }
          const id = resolved || null;
          match.state.bowlerId = id;
          if (id) {
            ensureBowler(inningsScore, match, bowlingSlot, id);
            match.state.awaitingNewBowler = false;
          }
        }
      }

      // Clear the "pick a new batter" prompt once both ends are filled.
      if (match.state.strikerId && match.state.nonStrikerId) {
        match.state.awaitingNewBatter = false;
      }
    }
    if (score) match.score = score;

    // If setting toss, we usually transition from UPCOMING to LIVE
    if (toss && match.state.status === "UPCOMING") {
      match.state.status = "LIVE";
      match.startedAt = match.startedAt || new Date();
    }
    if (state?.status === "LIVE") {
      match.startedAt = match.startedAt || new Date();
    }

    match.markModified("state");
    match.markModified("score");
    await match.save();
    emitToRoom(req, match._id, "match:scoreUpdated", match);
    emitToRoom(req, "global", "match:scoreUpdated", match); // Let dashboard know
    
    res.json({ success: true, match });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.scoreBall = async (req, res) => {
  try {
    const match = await LiveMatch.findById(req.params.id);
    if (!match) return res.status(404).json({ success: false, error: "Match not found" });

    if (match.state.status !== "LIVE") {
      return res.status(400).json({ success: false, error: "Start or resume the innings before scoring" });
    }

    const { runs = 0, isBoundary = false, extras = null, isWicket = false, wicketDetails, strikerId, nonStrikerId, bowlerId } = req.body;
    const boundary = isBoundary === true;
    const wicketTaken = isWicket === true;
    const batRuns = Number(runs);
    const extraRuns = extras ? Number(extras.runs) : 0;
    const extraType = extras?.type || null;
    if (!Number.isInteger(batRuns) || batRuns < 0 || batRuns > 6) {
      return res.status(400).json({ success: false, error: "Runs must be a whole number from 0 to 6" });
    }
    if (extraType && !["WD", "NB", "LB", "B"].includes(extraType)) {
      return res.status(400).json({ success: false, error: "Invalid extra type" });
    }
    if (extraType && (!Number.isInteger(extraRuns) || extraRuns < 1 || extraRuns > 6)) {
      return res.status(400).json({ success: false, error: "Extras must be a whole number from 1 to 6" });
    }
    if (boundary && ![4, 6].includes(batRuns)) {
      return res.status(400).json({ success: false, error: "A boundary must be 4 or 6 runs" });
    }
    const currentInningsIndex = match.state.currentInnings === 1 ? "firstInnings" : "secondInnings";
    const inningsScore = match.score[currentInningsIndex];

    // Basic team scoring: a delivery is never blocked on batsman / bowler
    // selection. Clear any stale "waiting for a new batsman / bowler" flags left
    // over from an older player-aware session so the match never gets stuck.
    match.state.awaitingNewBatter = false;
    match.state.awaitingNewBowler = false;

    const battingSlot = match.state.battingTeamId;
    const bowlingSlot = match.state.bowlingTeamId;

    // Resolve the players involved in this delivery from the roster-backed cards.
    const strikerRow = ensureBatter(inningsScore, match, battingSlot, match.state.strikerId);
    const nonStrikerRow = ensureBatter(inningsScore, match, battingSlot, match.state.nonStrikerId);
    const bowlerRow = ensureBowler(inningsScore, match, bowlingSlot, match.state.bowlerId);
    const bowlerName = bowlerRow?.name || rosterPlayerName(match, bowlingSlot, match.state.bowlerId, "Bowler");

    // Calculate sequence and over numbers
    const lastBall = await BallEvent.findOne({ matchId: match._id }).sort({ sequenceNumber: -1 });
    const sequenceNumber = lastBall ? lastBall.sequenceNumber + 1 : 1;
    
    const overNumber = Math.floor(inningsScore.legalBalls / 6);
    const ballNumber = (inningsScore.legalBalls % 6) + 1;

    // Create the ball event
    const ballEvent = new BallEvent({
      matchId: match._id,
      previousState: cloneValue(match.state),
      previousScore: cloneValue(match.score),
      previousTarget: match.target,
      previousWinner: match.winner,
      previousResultText: match.resultText,
      innings: match.state.currentInnings,
      sequenceNumber,
      overNumber,
      ballNumber,
      strikerId: strikerId || match.state.strikerId || "",
      nonStrikerId: nonStrikerId || match.state.nonStrikerId || "",
      bowlerId: bowlerId || match.state.bowlerId || "",
      runsOffBat: batRuns,
      isBoundary: boundary,
      extras: extraType ? { type: extraType, runs: extraRuns } : { type: null, runs: 0 },
      isLegalDelivery: !(extraType === "WD" || extraType === "NB"),
      isWicket: wicketTaken,
      wicket: wicketDetails || { type: null, dismissedPlayerId: null, fielderId: null }
    });

    await ballEvent.save();

    // Update match score
    let totalRuns = batRuns + extraRuns;
    inningsScore.runs += totalRuns;
    
    if (extras) {
      inningsScore.extras += extraRuns;
    }
    
    if (ballEvent.isLegalDelivery) {
      inningsScore.legalBalls += 1;
    }
    
    if (wicketTaken) {
      inningsScore.wickets += 1;
    }

    // --- Per-player statistics -------------------------------------------------
    // Batter faces a ball on every delivery except a wide.
    if (strikerRow) {
      if (extraType !== "WD") strikerRow.balls += 1;
      strikerRow.runs += batRuns;
      if (batRuns === 4) strikerRow.fours += 1;
      if (batRuns === 6) strikerRow.sixes += 1;
    }

    // Bowler figures: byes / leg-byes are NOT charged to the bowler.
    if (bowlerRow) {
      if (ballEvent.isLegalDelivery) bowlerRow.legalBalls += 1;
      bowlerRow.runsConceded +=
        batRuns + (extraType === "WD" || extraType === "NB" ? extraRuns : 0);
      if (extraType === "WD") bowlerRow.wides += extraRuns;
      if (extraType === "NB") bowlerRow.noBalls += 1;
    }

    // --- Wicket details -----------------------------------------------------
    let dismissedSlot = null; // "striker" | "nonStriker"
    if (wicketTaken) {
      const dismissalType = (wicketDetails && wicketDetails.type) || "Other";
      // Fielder: accept an existing id, or a typed name (registered on the
      // fielding side's roster when new). Optional — blank is fine.
      let fielderId = (wicketDetails && wicketDetails.fielderId) || null;
      if (!fielderId && wicketDetails && cleanText(wicketDetails.fielderName)) {
        const f = resolveOrCreateRosterPlayer(match, bowlingSlot, wicketDetails.fielderName);
        fielderId = f ? f.id : null;
      }
      const fielderName = fielderId
        ? rosterPlayerName(match, bowlingSlot, fielderId, "")
        : "";

      const requestedOutId = wicketDetails && wicketDetails.dismissedPlayerId
        ? String(wicketDetails.dismissedPlayerId)
        : null;
      let outRow = strikerRow;
      dismissedSlot = "striker";
      if (requestedOutId && nonStrikerRow && String(nonStrikerRow.playerId) === requestedOutId) {
        outRow = nonStrikerRow;
        dismissedSlot = "nonStriker";
      }

      if (outRow) {
        outRow.isOut = true;
        outRow.dismissalType = dismissalType;
        outRow.dismissalText = buildDismissalText(dismissalType, bowlerName, fielderName);
        outRow.bowlerId = bowlerCreditedWicket(dismissalType) ? String(match.state.bowlerId || "") : null;
        outRow.fielderId = fielderId;
      }

      if (bowlerRow && bowlerCreditedWicket(dismissalType)) {
        bowlerRow.wickets += 1;
      }

      inningsScore.fallOfWickets.push({
        wicketNumber: inningsScore.wickets,
        runs: inningsScore.runs,
        oversDisplay: oversDisplay(inningsScore.legalBalls),
        playerOutId: outRow ? String(outRow.playerId) : null,
        playerOutName: outRow ? outRow.name : "",
      });

      // Update the BallEvent so history / undo diagnostics are accurate.
      ballEvent.wicket = {
        type: dismissalType,
        dismissedPlayerId: outRow ? String(outRow.playerId) : (requestedOutId || null),
        fielderId,
      };
      ballEvent.markModified("wicket");
      await ballEvent.save();
    }

    // --- Strike rotation ---------------------------------------------------
    // Rotate on odd runs off the bat AND on odd bye / leg-bye runs.
    const runsForRotation = batRuns + (["B", "LB"].includes(extraType) ? extraRuns : 0);
    let shouldRotate = false;
    if (runsForRotation % 2 !== 0) shouldRotate = !shouldRotate;

    const overComplete = ballEvent.isLegalDelivery && inningsScore.legalBalls % 6 === 0;
    if (overComplete) {
      shouldRotate = !shouldRotate;
    }

    if (shouldRotate && match.state.strikerId && match.state.nonStrikerId) {
      const temp = match.state.strikerId;
      match.state.strikerId = match.state.nonStrikerId;
      match.state.nonStrikerId = temp;
    }
    // `dismissedSlot` is kept for the BallEvent record only — the basic team
    // console just counts the wicket and never blocks for a replacement.
    void dismissedSlot;

    // --- This-over delivery strip ----------------------------------------
    let ballSymbol;
    if (wicketTaken) ballSymbol = batRuns > 0 ? `${batRuns}+W` : "W";
    else if (extraType === "WD") ballSymbol = extraRuns > 1 ? `Wd${extraRuns}` : "Wd";
    else if (extraType === "NB") ballSymbol = batRuns > 0 ? `Nb${batRuns}` : "Nb";
    else if (extraType === "B") ballSymbol = `${extraRuns}B`;
    else if (extraType === "LB") ballSymbol = `${extraRuns}Lb`;
    else ballSymbol = batRuns === 0 ? "•" : String(batRuns);

    if (!Array.isArray(match.state.thisOver)) match.state.thisOver = [];
    // Start a fresh strip once the previous over was fully bowled.
    const legalBefore = inningsScore.legalBalls - (ballEvent.isLegalDelivery ? 1 : 0);
    if (legalBefore > 0 && legalBefore % 6 === 0) match.state.thisOver = [];
    match.state.thisOver.push(ballSymbol);
    match.state.lastBallText = ballSymbol;

    // Resolve "Team A"/"Team B" slots to actual team names for results.
    const nameFor = (slot) => {
      const t = slot === "Team A" ? match.teamA : slot === "Team B" ? match.teamB : null;
      return t?.name || t?.shortName || slot || "Team";
    };

    // Check if innings over
    if (inningsScore.wickets >= 10 || inningsScore.legalBalls >= (match.overs * 6)) {
      if (match.state.currentInnings === 1) {
        match.state.status = "INNINGS_BREAK";
        match.state.currentInnings = 2;
        match.target = inningsScore.runs + 1;
        const prevBatting = match.state.battingTeamId;
        match.state.battingTeamId = match.state.bowlingTeamId;
        match.state.bowlingTeamId = prevBatting;
        // Reset the crease for the second innings.
        match.state.strikerId = null;
        match.state.nonStrikerId = null;
        match.state.bowlerId = null;
        match.state.thisOver = [];
        match.state.lastBallText = "";
        match.state.awaitingNewBatter = false;
        match.state.awaitingNewBowler = false;
      } else {
        match.state.status = "COMPLETED";
        if (inningsScore.runs >= match.target) {
           match.winner = nameFor(match.state.battingTeamId);
           match.resultText = `${match.winner} won`;
        } else if (inningsScore.runs === match.target - 1) {
           match.winner = "Tie";
           match.resultText = "Match Tied";
        } else {
           match.winner = nameFor(match.state.bowlingTeamId);
           match.resultText = `${match.winner} won by ${match.target - 1 - inningsScore.runs} runs`;
        }
      }
    }

    // Check if target chased
    if (match.state.currentInnings === 2 && match.target && inningsScore.runs >= match.target) {
        match.state.status = "COMPLETED";
        match.winner = nameFor(match.state.battingTeamId);
        match.resultText = `${match.winner} won by ${10 - inningsScore.wickets} wickets`;
    }

    if (match.state.status === "COMPLETED") {
      match.state.awaitingNewBatter = false;
      match.state.awaitingNewBowler = false;
    }

    // When the match finishes naturally, archive it to CompletedMatch so it
    // shows on the user "Result" tab and the admin "Completed" list.
    if (match.state.status === "COMPLETED") {
      try {
        const already = await CompletedMatch.findOne({ sourceMatchId: match._id });
        if (!already) {
           await archiveCompletedMatch(match);
          emitToRoom(req, "global", "match:completed", match);
        }
      } catch (archiveErr) {
        console.error("Failed to archive completed match:", archiveErr.message);
      }
    }

    // `state` is an inline nested object; array mutations inside it (thisOver)
    // are not auto-tracked by Mongoose, so flag it explicitly.
    match.markModified("state");
    match.markModified("score");
    await match.save();
    emitToRoom(req, match._id, "match:scoreUpdated", match);
    emitToRoom(req, "global", "match:scoreUpdated", match);

    res.json({ success: true, match, ballEvent });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.undoLastBall = async (req, res) => {
  try {
    const match = await LiveMatch.findById(req.params.id);
    if (!match) return res.status(404).json({ success: false, error: "Match not found" });

    const lastBall = await BallEvent.findOne({ matchId: match._id }).sort({ sequenceNumber: -1 });
    if (!lastBall) return res.status(400).json({ success: false, error: "No balls to undo" });

    if (!lastBall.previousState || !lastBall.previousScore) {
      return res.status(400).json({ success: false, error: "This ball cannot be safely undone" });
    }

    // Restore the exact pre-ball snapshot, including innings transitions and
    // every per-player statistic (batting[], bowling[], fallOfWickets[]) and
    // crease state (striker/non-striker/bowler, thisOver) — all of which are
    // nested inside `state` / `score` and captured by the snapshot in scoreBall.
    match.state = lastBall.previousState;
    match.score = lastBall.previousScore;
    match.target = lastBall.previousTarget;
    match.winner = lastBall.previousWinner;
    match.resultText = lastBall.previousResultText;
    match.markModified("state");
    match.markModified("score");

    // If that ball had completed the match, roll the archive back too.
    await CompletedMatch.deleteOne({ sourceMatchId: match._id });

    await lastBall.deleteOne();
    await match.save();

    emitToRoom(req, match._id, "match:scoreUpdated", match);
    emitToRoom(req, "global", "match:scoreUpdated", match);

    res.json({ success: true, match });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.completeMatch = async (req, res) => {
  try {
    const match = await LiveMatch.findById(req.params.id);
    if (!match) return res.status(404).json({ success: false, error: "Match not found" });

    match.state.status = "COMPLETED";

    // If the match is ended before a natural finish, derive a result from
    // whatever score we have so the "Result" tab still shows something useful.
    let winner = match.winner;
    let resultText = match.resultText;
    if (!resultText) {
      const a = match.score?.firstInnings?.runs || 0;
      const b = match.score?.secondInnings?.runs || 0;
      const teamAName = match.teamA?.name || match.teamA?.shortName || "Team A";
      const teamBName = match.teamB?.name || match.teamB?.shortName || "Team B";
      if (b === 0 && a === 0) {
        resultText = "Match ended - no result";
      } else if (a === b) {
        winner = "Tie";
        resultText = "Match tied";
      } else {
        // firstInnings is the team that batted first; without richer state we
        // attribute the higher total to the batting-first side.
        winner = a > b ? teamAName : teamBName;
        resultText = `${winner} won`;
      }
    }

    match.winner = winner;
    match.resultText = resultText;
    const completedMatch = await archiveCompletedMatch(match);

    // Optionally delete from LiveMatch, or just leave it there and UI filters it
    // Let's delete it so the 'active' collection doesn't grow huge
    await match.deleteOne();
    
    emitToRoom(req, "global", "match:completed", completedMatch);

    res.json({ success: true, match: completedMatch });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ---------------------------------------------------------------------------
// EDIT MATCH — PUT /api/live-matches/:id
// Works whether :id is a LiveMatch (UPCOMING / LIVE / INNINGS_BREAK) or a
// CompletedMatch archive. Only match metadata is touched — never the score,
// innings, ball events or player state. Both docs are kept in sync when a
// naturally-completed match still has a LiveMatch alongside its archive.
// ---------------------------------------------------------------------------
exports.updateMatch = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid match id" });
    }

    const { matchName, format, overs, venue, scheduledAt, teamA, teamB, status } = req.body;

    const nMatchName = cleanText(matchName);
    const nFormat = cleanText(format);
    const nVenue = cleanText(venue);
    const nAName = cleanText(teamA && teamA.name);
    const nAShort = cleanText(teamA && teamA.shortName);
    const nBName = cleanText(teamB && teamB.name);
    const nBShort = cleanText(teamB && teamB.shortName);
    const hasOvers = overs !== undefined && overs !== null && overs !== "";
    const parsedOvers = hasOvers ? Number(overs) : undefined;
    const parsedSchedule = scheduledAt ? new Date(scheduledAt) : undefined;

    if (!nMatchName || nMatchName.length > 120 || !nAName || !nAShort || !nBName || !nBShort) {
      return res.status(400).json({ success: false, message: "Enter a match name and both team names / short names." });
    }
    if (nAName.toLowerCase() === nBName.toLowerCase()) {
      return res.status(400).json({ success: false, message: "Team A and Team B must be different teams." });
    }
    if (nAShort.toLowerCase() === nBShort.toLowerCase()) {
      return res.status(400).json({ success: false, message: "Team short names must be different." });
    }
    if (parsedOvers !== undefined && (!Number.isSafeInteger(parsedOvers) || parsedOvers < 1 || parsedOvers > 100)) {
      return res.status(400).json({ success: false, message: "Overs must be a whole number from 1 to 100." });
    }
    if (parsedSchedule !== undefined && Number.isNaN(parsedSchedule.getTime())) {
      return res.status(400).json({ success: false, message: "Enter a valid match date and time." });
    }

    const completedSet = {
      matchName: nMatchName,
      venueSnapshot: nVenue,
      ...(nFormat ? { format: nFormat } : {}),
      ...(parsedOvers !== undefined ? { overs: parsedOvers } : {}),
      ...(parsedSchedule !== undefined ? { scheduledAt: parsedSchedule } : {}),
      "teamA.nameSnapshot": nAName,
      "teamA.shortNameSnapshot": nAShort,
      "teamB.nameSnapshot": nBName,
      "teamB.shortNameSnapshot": nBShort,
    };
    const liveSet = {
      matchName: nMatchName,
      venue: nVenue,
      ...(nFormat ? { format: nFormat } : {}),
      ...(parsedOvers !== undefined ? { overs: parsedOvers } : {}),
      ...(parsedSchedule !== undefined ? { scheduledAt: parsedSchedule } : {}),
      "teamA.name": nAName,
      "teamA.shortName": nAShort,
      "teamB.name": nBName,
      "teamB.shortName": nBShort,
    };

    // ---- LiveMatch ----
    const liveMatch = await LiveMatch.findById(id);
    if (liveMatch) {
      Object.assign(liveMatch, {
        matchName: nMatchName,
        venue: nVenue,
        ...(nFormat ? { format: nFormat } : {}),
        ...(parsedOvers !== undefined ? { overs: parsedOvers } : {}),
        ...(parsedSchedule !== undefined ? { scheduledAt: parsedSchedule } : {}),
      });
      liveMatch.teamA.name = nAName;
      liveMatch.teamA.shortName = nAShort;
      liveMatch.teamB.name = nBName;
      liveMatch.teamB.shortName = nBShort;

      // Optional status change: only the pre-match UPCOMING <-> CANCELLED
      // transition is allowed here — anything else belongs to the scoring flow.
      if (status && status !== liveMatch.state.status) {
        const safe = ["UPCOMING", "CANCELLED"];
        if (safe.includes(status) && safe.includes(liveMatch.state.status)) {
          liveMatch.state.status = status;
        } else {
          return res.status(400).json({ success: false, message: "Match status can only be changed before the match has started." });
        }
      }

      liveMatch.markModified("teamA");
      liveMatch.markModified("teamB");
      liveMatch.markModified("state");
      await liveMatch.save();

      await CompletedMatch.updateOne({ sourceMatchId: liveMatch._id }, { $set: completedSet });

      emitToRoom(req, "global", "match:updated", liveMatch);
      emitToRoom(req, "global", "match:scoreUpdated", liveMatch);
      return res.json({ success: true, match: liveMatch });
    }

    // ---- CompletedMatch archive ----
    const completed = await CompletedMatch.findById(id);
    if (completed) {
      await CompletedMatch.updateOne({ _id: completed._id }, { $set: completedSet });
      if (completed.sourceMatchId) {
        await LiveMatch.updateOne({ _id: completed.sourceMatchId }, { $set: liveSet });
      }
      const fresh = await CompletedMatch.findById(completed._id);
      emitToRoom(req, "global", "match:updated", fresh);
      emitToRoom(req, "global", "match:completed", fresh);
      return res.json({ success: true, match: fresh });
    }

    return res.status(404).json({ success: false, error: "Match not found" });
  } catch (err) {
    const status = err && (err.name === "ValidationError" || err.name === "CastError") ? 400 : 500;
    res.status(status).json({
      success: false,
      message: status === 500 ? "Unable to update the match right now." : err.message,
      error: err.message,
    });
  }
};

// ---------------------------------------------------------------------------
// DELETE MATCH — DELETE /api/live-matches/:id
// Identifies the match strictly by _id (never by team name). Cleans up the
// related live-scoring data (BallEvent) and the CompletedMatch archive so no
// orphaned documents remain. Tournament / Event / Registration collections
// are NOT touched — LiveMatch/CompletedMatch only carry an optional
// tournamentId reference and own no data on those collections.
// ---------------------------------------------------------------------------
exports.deleteMatch = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid match id" });
    }

    const liveMatch = await LiveMatch.findById(id);
    const completed = liveMatch
      ? await CompletedMatch.findOne({ sourceMatchId: id })
      : await CompletedMatch.findById(id);

    if (!liveMatch && !completed) {
      return res.status(404).json({ success: false, error: "Match not found" });
    }

    // The id that BallEvent.matchId / CompletedMatch.sourceMatchId point at.
    const liveId = liveMatch ? liveMatch._id : (completed && completed.sourceMatchId) || null;

    if (liveId) {
      await BallEvent.deleteMany({ matchId: liveId });
      await LiveMatch.deleteOne({ _id: liveId });
    }
    await CompletedMatch.deleteMany({
      $or: [{ _id: id }, ...(liveId ? [{ sourceMatchId: liveId }] : [])],
    });

    const payload = { _id: String(id), liveMatchId: liveId ? String(liveId) : null };
    emitToRoom(req, "global", "match:deleted", payload);
    res.json({ success: true, deleted: payload });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};


// --- PUBLIC / USER CONTROLLERS ---

exports.getLiveMatches = async (req, res) => {
  try {
    const matches = await LiveMatch.find({ "state.status": { $in: ["LIVE", "INNINGS_BREAK"] } });
    res.json({ success: true, matches });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getUpcomingMatches = async (req, res) => {
  try {
    const matches = await LiveMatch.find({ "state.status": "UPCOMING" });
    res.json({ success: true, matches });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getCompletedMatches = async (req, res) => {
  try {
    const matches = await CompletedMatch.find().sort({ completedAt: -1 });
    res.json({ success: true, matches });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getMatchScorecard = async (req, res) => {
  try {
    const activeMatch = await LiveMatch.findById(req.params.id);
    if (activeMatch) {
      const ballEvents = await BallEvent.find({ matchId: activeMatch._id }).sort({ sequenceNumber: 1 });
      return res.json({ success: true, type: "LIVE", match: activeMatch, ballEvents });
    }
    
    const completedMatch = await CompletedMatch.findOne({ sourceMatchId: req.params.id }) || await CompletedMatch.findById(req.params.id);
    if (completedMatch) {
      return res.json({ success: true, type: "COMPLETED", match: completedMatch });
    }
    
    res.status(404).json({ success: false, error: "Match not found" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
