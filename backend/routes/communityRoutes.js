const express = require("express");
const mongoose = require("mongoose");
const CommunityPost = require("../models/CommunityPost");
const protect = require("../middleware/authMiddleware");
const { normalisePhone, hashPhone, cleanText, cleanMultiline } = require("../utils/phone");

const router = express.Router();

const SPORTS = ["General", "Cricket", "Football", "Badminton", "Tennis", "Basketball", "Other"];
const MAX_POSTS_PER_HOUR = 10;
const recentPosts = new Map(); // authorId -> [timestamps]

function emit(req, event, payload) {
    const io = req.app.get("io");
    if (io) io.emit(event, payload);
}

function toPublic(p, viewerId) {
    return {
        _id: p._id,
        authorName: p.authorName,
        authorId: p.authorId,
        isOfficial: p.isOfficial,
        text: p.text,
        sport: p.sport,
        pinned: p.pinned,
        likeCount: p.likes.length,
        liked: Boolean(viewerId && p.likes.includes(viewerId)),
        commentCount: p.comments.length,
        comments: p.comments.map((c) => ({
            _id: c._id,
            authorName: c.authorName,
            authorId: c.authorId,
            text: c.text,
            createdAt: c.createdAt
        })),
        isMine: Boolean(viewerId && p.authorId === viewerId),
        createdAt: p.createdAt
    };
}

function isValidId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

// ==========================================
// FEED - PUBLIC   ?sport=&page=&phone=
// ==========================================
router.get("/posts", async (req, res) => {
    try {
        const phone = normalisePhone(req.query.phone);
        const viewerId = phone ? hashPhone(phone) : null;
        const limit = 15;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);

        const filter = { hidden: false };
        if (req.query.sport && SPORTS.includes(req.query.sport) && req.query.sport !== "General") {
            filter.sport = req.query.sport;
        }

        const [docs, total] = await Promise.all([
            CommunityPost.find(filter)
                .sort({ pinned: -1, createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            CommunityPost.countDocuments(filter)
        ]);

        res.json({
            posts: docs.map((d) => toPublic(d, viewerId)),
            total,
            hasMore: page * limit < total
        });
    } catch (error) {
        console.error("Community feed failed:", error.message);
        res.status(500).json({ message: "Unable to load the community feed." });
    }
});

router.post("/posts", async (req, res) => {
    try {
        const authorName = cleanText(req.body.name, 60);
        const phone = normalisePhone(req.body.phone);
        const text = cleanMultiline(req.body.text, 600);
        const sport = SPORTS.includes(req.body.sport) ? req.body.sport : "General";

        if (!authorName || !phone) {
            return res.status(400).json({ message: "Register your name and mobile number to post." });
        }
        if (text.length < 3) return res.status(400).json({ message: "Write a little more before posting." });

        const authorId = hashPhone(phone);
        const cutoff = Date.now() - 3600 * 1000;
        const recent = (recentPosts.get(authorId) || []).filter((t) => t > cutoff);
        if (recent.length >= MAX_POSTS_PER_HOUR) {
            return res.status(429).json({ message: "You're posting a lot — please slow down a little." });
        }
        recent.push(Date.now());
        recentPosts.set(authorId, recent);
        if (recentPosts.size > 5000) recentPosts.clear();

        const doc = await CommunityPost.create({ authorName, authorPhone: phone, authorId, text, sport });
        emit(req, "community:changed", { _id: doc._id });
        res.status(201).json({ post: toPublic(doc, authorId) });
    } catch (error) {
        console.error("Community post failed:", error.message);
        res.status(500).json({ message: "Unable to publish your post." });
    }
});

// Like / unlike (toggle)
router.post("/posts/:id/like", async (req, res) => {
    try {
        const phone = normalisePhone(req.body.phone);
        if (!phone) return res.status(400).json({ message: "Register to like posts." });
        if (!isValidId(req.params.id)) return res.status(404).json({ message: "Post not found." });
        const viewerId = hashPhone(phone);

        let doc = await CommunityPost.findOneAndUpdate(
            { _id: req.params.id, hidden: false, likes: viewerId },
            { $pull: { likes: viewerId } },
            { new: true }
        );
        if (!doc) {
            doc = await CommunityPost.findOneAndUpdate(
                { _id: req.params.id, hidden: false },
                { $addToSet: { likes: viewerId } },
                { new: true }
            );
        }
        if (!doc) return res.status(404).json({ message: "Post not found." });
        res.json({ post: toPublic(doc, viewerId) });
    } catch (error) {
        res.status(500).json({ message: "Unable to update like." });
    }
});

router.post("/posts/:id/comments", async (req, res) => {
    try {
        const authorName = cleanText(req.body.name, 60);
        const phone = normalisePhone(req.body.phone);
        const text = cleanMultiline(req.body.text, 300);
        if (!authorName || !phone) return res.status(400).json({ message: "Register to comment." });
        if (!text) return res.status(400).json({ message: "Write a comment first." });
        if (!isValidId(req.params.id)) return res.status(404).json({ message: "Post not found." });
        const viewerId = hashPhone(phone);

        const doc = await CommunityPost.findOneAndUpdate(
            { _id: req.params.id, hidden: false },
            { $push: { comments: { authorName, authorId: viewerId, text } } },
            { new: true }
        );
        if (!doc) return res.status(404).json({ message: "Post not found." });
        res.status(201).json({ post: toPublic(doc, viewerId) });
    } catch (error) {
        res.status(500).json({ message: "Unable to add your comment." });
    }
});

// Authors can delete their own post.
router.post("/posts/:id/delete", async (req, res) => {
    try {
        const phone = normalisePhone(req.body.phone);
        if (!phone || !isValidId(req.params.id)) return res.status(404).json({ message: "Post not found." });
        const doc = await CommunityPost.findOneAndDelete({ _id: req.params.id, authorId: hashPhone(phone) });
        if (!doc) return res.status(404).json({ message: "Post not found." });
        emit(req, "community:changed", { _id: doc._id });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: "Unable to delete post." });
    }
});

// ==========================================
// ADMIN
// ==========================================
router.get("/admin-posts", protect, async (req, res) => {
    try {
        const docs = await CommunityPost.find().sort({ pinned: -1, createdAt: -1 }).limit(200);
        res.json({
            posts: docs.map((d) => ({
                ...toPublic(d, null),
                authorPhone: d.authorPhone,
                hidden: d.hidden
            }))
        });
    } catch (error) {
        res.status(500).json({ message: "Unable to load posts." });
    }
});

// Official announcement (shown with a badge; pinned by default).
router.post("/admin-posts", protect, async (req, res) => {
    try {
        const text = cleanMultiline(req.body.text, 600);
        if (text.length < 3) return res.status(400).json({ message: "Write the announcement first." });
        const sport = SPORTS.includes(req.body.sport) ? req.body.sport : "General";
        const doc = await CommunityPost.create({
            authorName: "Find Your Turf",
            authorPhone: "",
            authorId: "official",
            isOfficial: true,
            text,
            sport,
            pinned: req.body.pinned !== false
        });
        emit(req, "community:changed", { _id: doc._id });
        res.status(201).json({ post: toPublic(doc, null) });
    } catch (error) {
        res.status(500).json({ message: "Unable to publish announcement." });
    }
});

router.put("/admin-posts/:id", protect, async (req, res) => {
    try {
        if (!isValidId(req.params.id)) return res.status(404).json({ message: "Post not found." });
        const update = {};
        if (typeof req.body.pinned === "boolean") update.pinned = req.body.pinned;
        if (typeof req.body.hidden === "boolean") update.hidden = req.body.hidden;
        const doc = await CommunityPost.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!doc) return res.status(404).json({ message: "Post not found." });
        emit(req, "community:changed", { _id: doc._id });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: "Unable to update post." });
    }
});

router.delete("/admin-posts/:id", protect, async (req, res) => {
    try {
        if (!isValidId(req.params.id)) return res.status(404).json({ message: "Post not found." });
        await CommunityPost.findByIdAndDelete(req.params.id);
        emit(req, "community:changed", { _id: req.params.id });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: "Unable to delete post." });
    }
});

module.exports = router;
