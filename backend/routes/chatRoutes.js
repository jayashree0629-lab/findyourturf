const express = require("express");
const mongoose = require("mongoose");
const ChatMessage = require("../models/ChatMessage");
const PlayerRequest = require("../models/PlayerRequest");
const protect = require("../middleware/authMiddleware");
const { normalisePhone, hashPhone, cleanText, cleanMultiline } = require("../utils/phone");

const router = express.Router();

const PUBLIC_ROOMS = [
    { id: "general", name: "General Lounge", description: "Say hi, find a game, talk sport." },
    { id: "cricket", name: "Cricket", description: "Box cricket, leather ball, tournaments." },
    { id: "football", name: "Football", description: "5-a-side, 7-a-side and friendlies." },
    { id: "badminton", name: "Badminton", description: "Doubles partners and court bookings." },
    { id: "tournaments", name: "Tournaments", description: "Team hunting and match-day chatter." }
];
const PUBLIC_ROOM_IDS = new Set(PUBLIC_ROOMS.map((r) => r.id));

const MAX_TEXT = 500;
const MIN_GAP_MS = 1200;
const lastSentAt = new Map(); // senderId -> timestamp (basic flood control)

function toPublic(m) {
    return {
        _id: m._id,
        room: m.room,
        senderName: m.senderName,
        senderId: m.senderId,
        text: m.text,
        createdAt: m.createdAt
    };
}

function isRequestRoom(room) {
    return /^req-[a-f0-9]{24}$/.test(room);
}

// Public rooms are open to any registered visitor. A game's private room is
// only open to its host and the players who joined.
async function canAccessRoom(room, phone) {
    if (PUBLIC_ROOM_IDS.has(room)) return { ok: true };
    if (!isRequestRoom(room)) return { ok: false, status: 404, message: "Chat room not found." };
    if (!phone) return { ok: false, status: 403, message: "Join the game to chat with its players." };

    const doc = await PlayerRequest.findById(room.slice(4));
    if (!doc || doc.status === "Removed") return { ok: false, status: 404, message: "Chat room not found." };
    const id = hashPhone(phone);
    const member = doc.hostId === id || doc.joiners.some((j) => j.playerId === id);
    return member
        ? { ok: true, title: `${doc.sport} · ${doc.hostName}'s game` }
        : { ok: false, status: 403, message: "Join the game to chat with its players." };
}

// ==========================================
// ROOMS
// ==========================================
router.get("/rooms", async (req, res) => {
    try {
        const since = new Date(Date.now() - 24 * 3600 * 1000);
        const stats = await ChatMessage.aggregate([
            { $match: { deleted: false, room: { $in: [...PUBLIC_ROOM_IDS] } } },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: "$room",
                    last: { $first: "$$ROOT" },
                    recent: { $sum: { $cond: [{ $gte: ["$createdAt", since] }, 1, 0] } }
                }
            }
        ]);
        const byRoom = Object.fromEntries(stats.map((s) => [s._id, s]));

        res.json({
            rooms: PUBLIC_ROOMS.map((r) => ({
                ...r,
                recentCount: byRoom[r.id] ? byRoom[r.id].recent : 0,
                lastMessage: byRoom[r.id]
                    ? {
                          text: byRoom[r.id].last.text,
                          senderName: byRoom[r.id].last.senderName,
                          createdAt: byRoom[r.id].last.createdAt
                      }
                    : null
            }))
        });
    } catch (error) {
        res.status(500).json({ message: "Unable to load chat rooms." });
    }
});

// Lets the client know its own senderId (to right-align its messages).
router.get("/me", (req, res) => {
    const phone = normalisePhone(req.query.phone);
    if (!phone) return res.status(400).json({ message: "Valid mobile number required." });
    res.json({ senderId: hashPhone(phone) });
});

// ==========================================
// MESSAGES   GET ?phone=&before=<ISO>&limit=
// ==========================================
router.get("/:room/messages", async (req, res) => {
    try {
        const room = String(req.params.room);
        const access = await canAccessRoom(room, normalisePhone(req.query.phone));
        if (!access.ok) return res.status(access.status).json({ message: access.message });

        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
        const filter = { room, deleted: false };
        if (req.query.before) {
            const before = new Date(req.query.before);
            if (!Number.isNaN(before.getTime())) filter.createdAt = { $lt: before };
        }

        const docs = await ChatMessage.find(filter).sort({ createdAt: -1 }).limit(limit);
        res.json({
            title: access.title || null,
            messages: docs.reverse().map(toPublic),
            hasMore: docs.length === limit
        });
    } catch (error) {
        res.status(500).json({ message: "Unable to load messages." });
    }
});

router.post("/:room/messages", async (req, res) => {
    try {
        const room = String(req.params.room);
        const senderName = cleanText(req.body.name, 60);
        const phone = normalisePhone(req.body.phone);
        const text = cleanMultiline(req.body.text, MAX_TEXT);

        if (!senderName || !phone) {
            return res.status(400).json({ message: "Register your name and mobile number to chat." });
        }
        if (!text) return res.status(400).json({ message: "Type a message first." });

        const access = await canAccessRoom(room, phone);
        if (!access.ok) return res.status(access.status).json({ message: access.message });

        const senderId = hashPhone(phone);
        const now = Date.now();
        if (now - (lastSentAt.get(senderId) || 0) < MIN_GAP_MS) {
            return res.status(429).json({ message: "You're sending messages too fast." });
        }
        lastSentAt.set(senderId, now);
        if (lastSentAt.size > 5000) lastSentAt.clear();

        const doc = await ChatMessage.create({
            room,
            senderName,
            senderPhone: phone,
            senderId,
            text
        });

        const payload = toPublic(doc);
        const io = req.app.get("io");
        if (io) io.to(`chat:${room}`).emit("chat:message", payload);

        res.status(201).json({ message: payload });
    } catch (error) {
        console.error("Chat send failed:", error.message);
        res.status(500).json({ message: "Message couldn't be sent." });
    }
});

// ==========================================
// ADMIN MODERATION
// ==========================================
router.get("/admin-messages", protect, async (req, res) => {
    try {
        const filter = {};
        if (req.query.room) filter.room = String(req.query.room);
        if (req.query.deleted !== "1") filter.deleted = false;
        const docs = await ChatMessage.find(filter).sort({ createdAt: -1 }).limit(200);
        res.json({
            messages: docs.map((m) => ({
                ...toPublic(m),
                senderPhone: m.senderPhone,
                deleted: m.deleted
            }))
        });
    } catch (error) {
        res.status(500).json({ message: "Unable to load messages." });
    }
});

router.delete("/admin-messages/:id", protect, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ message: "Message not found." });
        }
        const doc = await ChatMessage.findByIdAndUpdate(req.params.id, { deleted: true }, { new: true });
        if (!doc) return res.status(404).json({ message: "Message not found." });
        const io = req.app.get("io");
        if (io) io.to(`chat:${doc.room}`).emit("chat:deleted", { _id: doc._id, room: doc.room });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: "Unable to delete message." });
    }
});

module.exports = router;
module.exports.PUBLIC_ROOMS = PUBLIC_ROOMS;
