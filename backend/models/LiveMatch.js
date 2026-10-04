const mongoose = require("mongoose");

const playerSchema = new mongoose.Schema({
  playerId: { type: String, default: function() { return new mongoose.Types.ObjectId().toString(); } }, // Unique reference for this match
  name: { type: String, required: true },
  role: { type: String, enum: ["Batsman", "Bowler", "All Rounder", "Wicket Keeper"], default: "Batsman" },
  jerseyNumber: { type: String, default: "" },
  isCaptain: { type: Boolean, default: false },
});

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  shortName: { type: String, required: true },
  logo: { type: String, default: "" },
  players: [playerSchema],
});

// Per-batsman line in the innings scorecard. Lives INSIDE inningsScoreSchema so
// that the existing BallEvent.previousScore snapshot captures it and the
// existing undoLastBall restore reverts it with no extra code.
const batterStatSchema = new mongoose.Schema({
  playerId: { type: String, required: true },
  name: { type: String, default: "" },
  runs: { type: Number, default: 0 },
  balls: { type: Number, default: 0 },
  fours: { type: Number, default: 0 },
  sixes: { type: Number, default: 0 },
  isOut: { type: Boolean, default: false },
  dismissalText: { type: String, default: "" }, // e.g. "c Fielder b Bowler", "not out"
  dismissalType: { type: String, default: null }, // Bowled / Caught / LBW / Run Out / ...
  bowlerId: { type: String, default: null }, // bowler credited with the dismissal (if any)
  fielderId: { type: String, default: null },
  battingOrder: { type: Number, default: 0 },
});

// Per-bowler line in the innings scorecard.
const bowlerStatSchema = new mongoose.Schema({
  playerId: { type: String, required: true },
  name: { type: String, default: "" },
  legalBalls: { type: Number, default: 0 }, // -> overs = floor/6 . rem
  runsConceded: { type: Number, default: 0 },
  wickets: { type: Number, default: 0 },
  maidens: { type: Number, default: 0 },
  wides: { type: Number, default: 0 },
  noBalls: { type: Number, default: 0 },
});

const fallOfWicketSchema = new mongoose.Schema({
  wicketNumber: { type: Number, required: true },
  runs: { type: Number, default: 0 }, // team score when the wicket fell
  oversDisplay: { type: String, default: "0.0" },
  playerOutId: { type: String, default: null },
  playerOutName: { type: String, default: "" },
});

const inningsScoreSchema = new mongoose.Schema({
  runs: { type: Number, default: 0 },
  wickets: { type: Number, default: 0 },
  legalBalls: { type: Number, default: 0 }, // For overs calculation
  extras: { type: Number, default: 0 },
  // Extras split by type (runs). Lives in the innings so the BallEvent
  // snapshot / undo restores it with everything else.
  wides: { type: Number, default: 0 },
  noBalls: { type: Number, default: 0 },
  byes: { type: Number, default: 0 },
  legByes: { type: Number, default: 0 },
  batting: { type: [batterStatSchema], default: [] },
  bowling: { type: [bowlerStatSchema], default: [] },
  fallOfWickets: { type: [fallOfWicketSchema], default: [] },
});

const liveMatchSchema = new mongoose.Schema(
  {
    tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: "Tournament", required: false },
    matchName: { type: String, required: true },
    sport: { type: String, default: "Cricket" },
    format: { type: String, required: true }, // e.g., "T20", "Custom"
    overs: { type: Number, required: true },
    venue: { type: String, default: "" },
    scheduledAt: { type: Date, required: true },
    startedAt: { type: Date, default: null },
    
    teamA: { type: teamSchema, required: true },
    teamB: { type: teamSchema, required: true },
    
    toss: {
      wonBy: { type: String, enum: ["Team A", "Team B"], default: null },
      decision: { type: String, enum: ["BAT", "BOWL"], default: null },
    },
    
    state: {
      status: { type: String, enum: ["UPCOMING", "LIVE", "INNINGS_BREAK", "COMPLETED", "CANCELLED"], default: "UPCOMING" },
      currentInnings: { type: Number, default: 1 },
      battingTeamId: { type: String, enum: ["Team A", "Team B"], default: null },
      bowlingTeamId: { type: String, enum: ["Team A", "Team B"], default: null },
      strikerId: { type: String, default: null },
      nonStrikerId: { type: String, default: null },
      bowlerId: { type: String, default: null },
      // Deliveries in the current over, as display symbols e.g. ["1","4","W","Wd"].
      // Cleared when an over completes. Part of `state` so undo reverts it for free.
      thisOver: { type: [String], default: [] },
      lastBallText: { type: String, default: "" },
      awaitingNewBatter: { type: Boolean, default: false },
      awaitingNewBowler: { type: Boolean, default: false },
    },
    
    score: {
      firstInnings: { type: inningsScoreSchema, default: () => ({}) },
      secondInnings: { type: inningsScoreSchema, default: () => ({}) },
    },
    
    target: { type: Number, default: null },
    winner: { type: String, default: null }, // Team Name or "Tie"
    resultText: { type: String, default: null }, // e.g., "Team A won by 6 runs"
  },
  { timestamps: true }
);

module.exports = mongoose.model("LiveMatch", liveMatchSchema);
