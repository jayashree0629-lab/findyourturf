const express = require("express");
const router = express.Router();
const liveMatchController = require("../controllers/liveMatchController");
const protect = require("../middleware/authMiddleware");

// Admin routes
router.post("/", protect, liveMatchController.createMatch);
router.get("/admin", protect, liveMatchController.getAdminMatches);
router.get("/admin/:id", protect, liveMatchController.getMatchDetails);
router.post("/:id/state", protect, liveMatchController.updateMatchState);
router.post("/:id/score", protect, liveMatchController.scoreBall);
router.post("/:id/undo", protect, liveMatchController.undoLastBall);
router.post("/:id/end-innings", protect, liveMatchController.endInnings);
router.post("/:id/complete", protect, liveMatchController.completeMatch);
router.put("/:id", protect, liveMatchController.updateMatch);
router.delete("/:id", protect, liveMatchController.deleteMatch);

// User/Public routes
router.get("/live", liveMatchController.getLiveMatches);
router.get("/upcoming", liveMatchController.getUpcomingMatches);
router.get("/results", liveMatchController.getCompletedMatches);
router.get("/:id", liveMatchController.getMatchScorecard);

module.exports = router;
