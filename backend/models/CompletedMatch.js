const mongoose = require("mongoose");

// One innings of the archived scorecard. Shared by both innings so the two
// can never drift apart.
const fallOfWicketSchema = new mongoose.Schema({
  wicketNumber: { type: Number },
  runs: { type: Number, default: 0 },
  oversDisplay: { type: String, default: "0.0" },
  playerOutName: { type: String, default: "" },
});

const battingRowSchema = new mongoose.Schema({
  playerName: { type: String },
  runs: { type: Number, default: 0 },
  balls: { type: Number, default: 0 },
  fours: { type: Number, default: 0 },
  sixes: { type: Number, default: 0 },
  dismissal: { type: String, default: "not out" },
});

const bowlingRowSchema = new mongoose.Schema({
  playerName: { type: String },
  overs: { type: String, default: "0.0" },
  maidens: { type: Number, default: 0 },
  runs: { type: Number, default: 0 },
  wickets: { type: Number, default: 0 },
  noBalls: { type: Number, default: 0 },
  wides: { type: Number, default: 0 },
  economy: { type: String, default: "0.0" },
});

const inningsCardSchema = new mongoose.Schema(
  {
    team: { type: String },
    runs: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    oversDisplay: { type: String, default: "0.0" },
    extras: { type: Number, default: 0 },
    extrasBreakdown: {
      wides: { type: Number, default: 0 },
      noBalls: { type: Number, default: 0 },
      byes: { type: Number, default: 0 },
      legByes: { type: Number, default: 0 },
    },
    fallOfWickets: [fallOfWicketSchema],
    batting: [battingRowSchema],
    bowling: [bowlingRowSchema],
  },
  { _id: false }
);

const completedMatchSchema = new mongoose.Schema(
  {
    sourceMatchId: { type: mongoose.Schema.Types.ObjectId, ref: "LiveMatch", required: true, unique: true },
    tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: "Tournament", required: false },
    matchName: { type: String, required: true },
    sport: { type: String, default: "Cricket" },
    format: { type: String, required: true },
    overs: { type: Number, required: true },
    venueSnapshot: { type: String, default: "" },
    scheduledAt: { type: Date, required: true },
    startedAt: { type: Date, required: false },
    completedAt: { type: Date, default: Date.now },

    teamA: {
      teamId: { type: String },
      nameSnapshot: { type: String },
      shortNameSnapshot: { type: String },
      logoSnapshot: { type: String },
      players: [
        {
          originalPlayerId: { type: String },
          nameSnapshot: { type: String },
          roleSnapshot: { type: String },
          jerseyNumberSnapshot: { type: String }
        }
      ]
    },

    teamB: {
      teamId: { type: String },
      nameSnapshot: { type: String },
      shortNameSnapshot: { type: String },
      logoSnapshot: { type: String },
      players: [
        {
          originalPlayerId: { type: String },
          nameSnapshot: { type: String },
          roleSnapshot: { type: String },
          jerseyNumberSnapshot: { type: String }
        }
      ]
    },

    winner: { type: String, default: null }, // Team name or "Tie"
    resultText: { type: String, default: null },
    toss: {
      wonBy: { type: String },
      decision: { type: String }
    },

    status: { type: String, default: "COMPLETED" },

    // Storing final scorecards instead of calculating on the fly
    scorecards: {
      firstInnings: { type: inningsCardSchema, default: () => ({}) },
      secondInnings: { type: inningsCardSchema, default: () => ({}) },
    },

    // Optional array of summarized ball events for history playback
    ballHistory: [
      {
        innings: { type: Number },
        overNumber: { type: Number },
        ballNumber: { type: Number },
        strikerName: { type: String },
        bowlerName: { type: String },
        summary: { type: String } // e.g. "4", "W", "1", "WD"
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model("CompletedMatch", completedMatchSchema);
