const express = require("express");
const Visitor = require("../models/Visitor");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

const { normalisePhone } = require("../utils/phone");

function toPublicVisitor(doc) {
    return {
        id: doc._id,
        name: doc.name,
        phone: doc.phone
    };
}

// ==========================================
// QUICK REGISTRATION - PUBLIC
// Creates a visitor on first submission; on a repeat phone number it just
// touches lastVisitedAt and returns the existing record (no duplicates).
// ==========================================
router.post("/register", async (req, res) => {
    try {
        const name = String(req.body.name || "").trim();
        const phone = normalisePhone(req.body.phone);

        if (!name) {
            return res.status(400).json({ success: false, message: "Please enter your name." });
        }
        if (!phone) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid 10-digit Indian mobile number."
            });
        }

        let visitor = await Visitor.findOne({ phone });

        if (visitor) {
            visitor.lastVisitedAt = new Date();
            await visitor.save();
        } else {
            try {
                visitor = await Visitor.create({ name, phone });
            } catch (createErr) {
                // Race: two tabs registered the same number at once.
                if (createErr.code === 11000) {
                    visitor = await Visitor.findOne({ phone });
                    if (visitor) {
                        visitor.lastVisitedAt = new Date();
                        await visitor.save();
                    }
                } else {
                    throw createErr;
                }
            }
        }

        if (!visitor) {
            return res.status(500).json({ success: false, message: "Unable to save your details right now." });
        }

        res.status(201).json({ success: true, visitor: toPublicVisitor(visitor) });

    } catch (error) {
        // Never surface raw Mongo errors / stack traces, and never log the phone.
        console.error("Visitor registration failed:", error.message);
        res.status(500).json({
            success: false,
            message: "Unable to save your details right now. Please try again."
        });
    }
});


// ==========================================
// LIST VISITORS - ADMIN ONLY
//   ?page=1&limit=50  (optional; defaults to a single generous page)
// ==========================================
router.get("/", protect, async (req, res) => {
    try {
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);

        const [visitors, total] = await Promise.all([
            Visitor.find()
                .sort({ lastVisitedAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            Visitor.countDocuments()
        ]);

        res.json({
            success: true,
            visitors: visitors.map((v) => ({
                id: v._id,
                name: v.name,
                phone: v.phone,
                registeredAt: v.createdAt,
                lastVisitedAt: v.lastVisitedAt
            })),
            total,
            page,
            limit
        });

    } catch (error) {
        console.error("Failed to load visitors:", error.message);
        res.status(500).json({ success: false, message: "Unable to load visitors right now." });
    }
});


module.exports = router;
