const express = require("express");
const mongoose = require("mongoose");
const PlayerRequest = require("../models/PlayerRequest");
const protect = require("../middleware/authMiddleware");
const { normalisePhone, hashPhone, cleanText, cleanMultiline } = require("../utils/phone");

const router = express.Router();

const MAX_OPEN_PER_HOST = 5;

function emit(req, event, payload) {
    const io = req.app.get("io");
    if (io) io.emit(event, payload);
}

// Today's calendar day in Coimbatore, as UTC midnight (how dates are stored).
function startOfTodayUTC() {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    return new Date(`${today}T00:00:00Z`);
}

function isValidId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

// Public shape: no phone numbers, only names + stable ids.
function toPublic(doc, viewerId) {
    const joiners = doc.joiners || [];
    const spotsLeft = Math.max(0, doc.playersNeeded - joiners.length);
    return {
        _id: doc._id,
        sport: doc.sport,
        turfName: doc.turfName,
        area: doc.area,
        date: doc.date,
        time: doc.time,
        playersNeeded: doc.playersNeeded,
        spotsLeft,
        skillLevel: doc.skillLevel,
        costPerPlayer: doc.costPerPlayer,
        notes: doc.notes,
        hostName: doc.hostName,
        hostId: doc.hostId,
        joinerNames: joiners.map((j) => j.name),
        joinedCount: joiners.length,
        status: doc.status,
        createdAt: doc.createdAt,
        isHost: Boolean(viewerId && doc.hostId === viewerId),
        hasJoined: Boolean(viewerId && joiners.some((j) => j.playerId === viewerId))
    };
}

function syncStatus(doc) {
    if (doc.status === "Open" || doc.status === "Full") {
        doc.status = doc.joiners.length >= doc.playersNeeded ? "Full" : "Open";
    }
}

// ==========================================
// LIST - PUBLIC   ?sport=&area=&phone=&mine=1&includePast=1
// Upcoming (today or later) requests that are still Open/Full.
// ==========================================
router.get("/", async (req, res) => {
    try {
        const phone = normalisePhone(req.query.phone);
        const viewerId = phone ? hashPhone(phone) : null;
        const filter = { status: { $in: ["Open", "Full"] }, date: { $gte: startOfTodayUTC() } };

        if (req.query.sport && req.query.sport !== "All") {
            filter.sport = cleanText(req.query.sport, 40);
        }
        if (req.query.area) {
            filter.area = new RegExp(cleanText(req.query.area, 40).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        }
        if (req.query.mine === "1") {
            if (!viewerId) return res.json({ requests: [] });
            delete filter.date;
            filter.status = { $in: ["Open", "Full", "Closed"] };
            filter.$or = [{ hostId: viewerId }, { "joiners.playerId": viewerId }];
        }

        const docs = await PlayerRequest.find(filter).sort({ date: 1, createdAt: -1 }).limit(100);
        res.json({ requests: docs.map((d) => toPublic(d, viewerId)) });
    } catch (error) {
        console.error("Player requests list failed:", error.message);
        res.status(500).json({ message: "Unable to load player requests right now." });
    }
});

// ==========================================
// CREATE - PUBLIC
// ==========================================
router.post("/", async (req, res) => {
    try {
        const hostName = cleanText(req.body.name, 60);
        const hostPhone = normalisePhone(req.body.phone);
        const sport = cleanText(req.body.sport, 40);
        const time = cleanText(req.body.time, 20);
        const playersNeeded = parseInt(req.body.playersNeeded, 10);
        const date = new Date(req.body.date);

        if (!hostName || !hostPhone) {
            return res.status(400).json({ message: "Your name and a valid mobile number are required." });
        }
        if (!sport) return res.status(400).json({ message: "Pick a sport." });
        if (!time) return res.status(400).json({ message: "Pick a start time." });
        if (Number.isNaN(date.getTime())) return res.status(400).json({ message: "Pick a valid date." });
        if (!(playersNeeded >= 1 && playersNeeded <= 30)) {
            return res.status(400).json({ message: "Players needed must be between 1 and 30." });
        }

        const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
        if (day < startOfTodayUTC()) {
            return res.status(400).json({ message: "The game date can't be in the past." });
        }

        const hostId = hashPhone(hostPhone);
        const openCount = await PlayerRequest.countDocuments({
            hostId,
            status: { $in: ["Open", "Full"] },
            date: { $gte: startOfTodayUTC() }
        });
        if (openCount >= MAX_OPEN_PER_HOST) {
            return res.status(429).json({
                message: `You already have ${MAX_OPEN_PER_HOST} active requests. Close one before posting another.`
            });
        }

        const skill = ["Any", "Beginner", "Intermediate", "Advanced"].includes(req.body.skillLevel)
            ? req.body.skillLevel
            : "Any";

        const doc = await PlayerRequest.create({
            sport,
            turfName: cleanText(req.body.turfName, 80),
            area: cleanText(req.body.area, 60),
            date: day,
            time,
            playersNeeded,
            skillLevel: skill,
            costPerPlayer: Math.max(0, Math.min(100000, parseInt(req.body.costPerPlayer, 10) || 0)),
            notes: cleanMultiline(req.body.notes, 300),
            hostName,
            hostPhone,
            hostId
        });

        emit(req, "players:changed", { _id: doc._id });
        res.status(201).json({ request: toPublic(doc, hostId) });
    } catch (error) {
        console.error("Player request create failed:", error.message);
        res.status(500).json({ message: "Unable to post your request right now." });
    }
});

// ==========================================
// JOIN - PUBLIC. The host's contact number is revealed on a successful join.
// ==========================================
router.post("/:id/join", async (req, res) => {
    try {
        if (!isValidId(req.params.id)) return res.status(404).json({ message: "Request not found." });

        const name = cleanText(req.body.name, 60);
        const phone = normalisePhone(req.body.phone);
        if (!name || !phone) {
            return res.status(400).json({ message: "Your name and a valid mobile number are required." });
        }
        const playerId = hashPhone(phone);

        const doc = await PlayerRequest.findById(req.params.id);
        if (!doc || doc.status === "Removed") return res.status(404).json({ message: "Request not found." });
        if (doc.status === "Closed") return res.status(400).json({ message: "The host has closed this request." });
        if (doc.hostId === playerId) return res.status(400).json({ message: "You're the host of this game." });
        if (doc.joiners.some((j) => j.playerId === playerId)) {
            return res.status(400).json({ message: "You've already joined this game." });
        }
        if (doc.joiners.length >= doc.playersNeeded) {
            return res.status(400).json({ message: "Sorry, this game is already full." });
        }

        // Atomic push guarded on remaining capacity so two simultaneous joins
        // can't overshoot the number of spots.
        const updated = await PlayerRequest.findOneAndUpdate(
            {
                _id: doc._id,
                status: "Open",
                "joiners.playerId": { $ne: playerId },
                $expr: { $lt: [{ $size: "$joiners" }, "$playersNeeded"] }
            },
            { $push: { joiners: { name, phone, playerId } } },
            { new: true }
        );
        if (!updated) return res.status(409).json({ message: "Sorry, the last spot was just taken." });

        syncStatus(updated);
        await updated.save();

        emit(req, "players:changed", { _id: updated._id });
        res.json({
            request: toPublic(updated, playerId),
            host: { name: updated.hostName, phone: updated.hostPhone }
        });
    } catch (error) {
        console.error("Player request join failed:", error.message);
        res.status(500).json({ message: "Unable to join right now." });
    }
});

// ==========================================
// LEAVE - PUBLIC
// ==========================================
router.post("/:id/leave", async (req, res) => {
    try {
        if (!isValidId(req.params.id)) return res.status(404).json({ message: "Request not found." });
        const phone = normalisePhone(req.body.phone);
        if (!phone) return res.status(400).json({ message: "Mobile number required." });
        const playerId = hashPhone(phone);

        const doc = await PlayerRequest.findById(req.params.id);
        if (!doc) return res.status(404).json({ message: "Request not found." });

        const before = doc.joiners.length;
        doc.joiners = doc.joiners.filter((j) => j.playerId !== playerId);
        if (doc.joiners.length === before) {
            return res.status(400).json({ message: "You haven't joined this game." });
        }
        syncStatus(doc);
        await doc.save();

        emit(req, "players:changed", { _id: doc._id });
        res.json({ request: toPublic(doc, playerId) });
    } catch (error) {
        res.status(500).json({ message: "Unable to update right now." });
    }
});

// ==========================================
// HOST/JOINER CONTACTS - by phone. The host sees every joiner's number,
// each joiner sees the host's number. Nobody else sees any.
// ==========================================
router.get("/:id/contacts", async (req, res) => {
    try {
        if (!isValidId(req.params.id)) return res.status(404).json({ message: "Request not found." });
        const phone = normalisePhone(req.query.phone);
        if (!phone) return res.status(400).json({ message: "Mobile number required." });
        const viewerId = hashPhone(phone);

        const doc = await PlayerRequest.findById(req.params.id);
        if (!doc) return res.status(404).json({ message: "Request not found." });

        if (doc.hostId === viewerId) {
            return res.json({
                role: "host",
                joiners: doc.joiners.map((j) => ({ name: j.name, phone: j.phone }))
            });
        }
        if (doc.joiners.some((j) => j.playerId === viewerId)) {
            return res.json({ role: "joiner", host: { name: doc.hostName, phone: doc.hostPhone } });
        }
        res.status(403).json({ message: "Join the game to see contact details." });
    } catch (error) {
        res.status(500).json({ message: "Unable to load contacts." });
    }
});

// ==========================================
// CLOSE (host) - PUBLIC, verified by the host's phone
// ==========================================
router.post("/:id/close", async (req, res) => {
    try {
        if (!isValidId(req.params.id)) return res.status(404).json({ message: "Request not found." });
        const phone = normalisePhone(req.body.phone);
        if (!phone) return res.status(400).json({ message: "Mobile number required." });

        const doc = await PlayerRequest.findById(req.params.id);
        if (!doc || doc.hostId !== hashPhone(phone)) {
            return res.status(404).json({ message: "Request not found." });
        }
        doc.status = "Closed";
        await doc.save();

        emit(req, "players:changed", { _id: doc._id });
        res.json({ request: toPublic(doc, doc.hostId) });
    } catch (error) {
        res.status(500).json({ message: "Unable to close right now." });
    }
});

// ==========================================
// ADMIN
// ==========================================
router.get("/admin/all", protect, async (req, res) => {
    try {
        const docs = await PlayerRequest.find().sort({ createdAt: -1 }).limit(300);
        res.json({
            requests: docs.map((d) => ({
                ...toPublic(d, null),
                hostPhone: d.hostPhone,
                joiners: d.joiners.map((j) => ({ name: j.name, phone: j.phone, joinedAt: j.joinedAt }))
            }))
        });
    } catch (error) {
        res.status(500).json({ message: "Unable to load player requests." });
    }
});

router.put("/admin/:id/status", protect, async (req, res) => {
    try {
        const status = req.body.status;
        if (!["Open", "Closed", "Removed"].includes(status)) {
            return res.status(400).json({ message: "Invalid status." });
        }
        if (!isValidId(req.params.id)) return res.status(404).json({ message: "Request not found." });
        const doc = await PlayerRequest.findById(req.params.id);
        if (!doc) return res.status(404).json({ message: "Request not found." });
        doc.status = status;
        syncStatus(doc);
        await doc.save();
        emit(req, "players:changed", { _id: doc._id });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: "Unable to update request." });
    }
});

module.exports = router;
