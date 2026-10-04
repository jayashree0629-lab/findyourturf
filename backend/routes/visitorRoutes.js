const express = require("express");
const Visitor = require("../models/Visitor");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

const { normalisePhone } = require("../utils/phone");
const { verifyGoogleCredential, googleConfigured } = require("../utils/google");

function toPublicVisitor(doc) {
    return {
        id: doc._id,
        name: doc.name,
        phone: doc.phone,
        email: doc.email || "",
        picture: doc.picture || ""
    };
}

// Lets the frontend know whether to offer the Google button.
router.get("/config", (req, res) => {
    res.json({ googleEnabled: googleConfigured() });
});

// ==========================================
// GOOGLE SIGN-IN - PUBLIC
// Returns the existing player when this Google account has signed up before;
// otherwise only the verified profile, so the app can ask for a mobile number.
// ==========================================
router.post("/google", async (req, res) => {
    try {
        const profile = await verifyGoogleCredential(req.body && req.body.credential);
        const existing = await Visitor.findOne({ $or: [{ googleId: profile.googleId }, { email: profile.email }] });
        if (existing) {
            existing.lastVisitedAt = new Date();
            if (!existing.googleId) existing.googleId = profile.googleId;
            if (!existing.email) existing.email = profile.email;
            if (!existing.picture) existing.picture = profile.picture;
            await existing.save();
            return res.json({ success: true, visitor: toPublicVisitor(existing), profile });
        }
        res.json({ success: true, visitor: null, profile: { name: profile.name, email: profile.email, picture: profile.picture } });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message || "Google sign-in failed." });
    }
});

// ==========================================
// SIGN IN WITH MOBILE NUMBER - PUBLIC
// For players who already signed up. Unknown numbers are told to sign up.
// ==========================================
router.post("/login", async (req, res) => {
    try {
        const phone = normalisePhone(req.body && req.body.phone);
        if (!phone) {
            return res.status(400).json({ success: false, message: "Enter a valid 10-digit mobile number." });
        }
        const visitor = await Visitor.findOne({ phone });
        if (!visitor) {
            return res.status(404).json({
                success: false,
                message: "We couldn't find an account with this number. Please sign up first."
            });
        }
        visitor.lastVisitedAt = new Date();
        await visitor.save();
        res.json({ success: true, visitor: toPublicVisitor(visitor) });
    } catch (error) {
        console.error("Visitor login failed:", error.message);
        res.status(500).json({ success: false, message: "Unable to sign you in right now. Please try again." });
    }
});

// ==========================================
// QUICK REGISTRATION - PUBLIC
// Creates a visitor on first submission; on a repeat phone number it just
// touches lastVisitedAt and returns the existing record (no duplicates).
// ==========================================
router.post("/register", async (req, res) => {
    try {
        let name = String(req.body.name || "").trim();
        const phone = normalisePhone(req.body.phone);

        // Optional Google details are only trusted after server-side verification.
        let google = null;
        if (req.body.googleCredential) {
            google = await verifyGoogleCredential(req.body.googleCredential);
            if (!name) name = google.name;
        }

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
            if (google) {
                visitor.googleId = google.googleId;
                visitor.email = google.email;
                if (!visitor.picture) visitor.picture = google.picture;
            }
            await visitor.save();
        } else {
            try {
                visitor = await Visitor.create({
                    name,
                    phone,
                    ...(google ? { googleId: google.googleId, email: google.email, picture: google.picture } : {})
                });
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
        if (error.status) {
            return res.status(error.status).json({ success: false, message: error.message });
        }
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
