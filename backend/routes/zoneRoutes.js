const express = require("express");
const mongoose = require("mongoose");
const ZoneEnquiry = require("../models/ZoneEnquiry");
const protect = require("../middleware/authMiddleware");
const { normalisePhone, cleanText, cleanMultiline } = require("../utils/phone");
const { createUniqueCoupon } = require("../utils/coupons");

const router = express.Router();

const ZONES = ["student", "corporate"];
const STATUSES = ["New", "In Review", "Approved", "Rejected", "Closed"];

function toMine(e) {
    return {
        _id: e._id,
        zone: e.zone,
        organization: e.organization,
        status: e.status,
        couponCode: e.couponCode,
        adminNote: e.status === "Approved" || e.status === "Rejected" ? e.adminNote : "",
        createdAt: e.createdAt
    };
}

// ==========================================
// SUBMIT - PUBLIC
// ==========================================
router.post("/enquiries", async (req, res) => {
    try {
        const zone = String(req.body.zone || "").toLowerCase();
        const name = cleanText(req.body.name, 60);
        const phone = normalisePhone(req.body.phone);
        const organization = cleanText(req.body.organization, 100);
        const email = cleanText(req.body.email, 100).toLowerCase();

        if (!ZONES.includes(zone)) return res.status(400).json({ message: "Unknown zone." });
        if (!name || !phone) {
            return res.status(400).json({ message: "Your name and a valid mobile number are required." });
        }
        if (!organization) {
            return res.status(400).json({
                message: zone === "student" ? "Enter your college name." : "Enter your company name."
            });
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ message: "Enter a valid email address or leave it blank." });
        }

        // One live request per phone per zone.
        const existing = await ZoneEnquiry.findOne({
            phone,
            zone,
            status: { $in: ["New", "In Review"] }
        });
        if (existing) {
            return res.status(409).json({
                message: "You already have a request in review. We'll contact you shortly."
            });
        }

        const preferred = req.body.preferredDate ? new Date(req.body.preferredDate) : null;

        const doc = await ZoneEnquiry.create({
            zone,
            name,
            phone,
            email,
            organization,
            detail: cleanText(req.body.detail, 100),
            groupSize: Math.max(1, Math.min(5000, parseInt(req.body.groupSize, 10) || 1)),
            sport: cleanText(req.body.sport, 40),
            preferredDate: preferred && !Number.isNaN(preferred.getTime()) ? preferred : null,
            message: cleanMultiline(req.body.message, 500)
        });

        const io = req.app.get("io");
        if (io) io.emit("zones:changed", { _id: doc._id });

        res.status(201).json({ enquiry: toMine(doc) });
    } catch (error) {
        console.error("Zone enquiry failed:", error.message);
        res.status(500).json({ message: "Unable to send your request right now." });
    }
});

// ==========================================
// MY REQUESTS - PUBLIC (by phone)
// ==========================================
router.get("/enquiries/mine", async (req, res) => {
    try {
        const phone = normalisePhone(req.query.phone);
        if (!phone) return res.json({ enquiries: [] });
        const docs = await ZoneEnquiry.find({ phone }).sort({ createdAt: -1 }).limit(20);
        res.json({ enquiries: docs.map(toMine) });
    } catch (error) {
        res.status(500).json({ message: "Unable to load your requests." });
    }
});

// ==========================================
// ADMIN
// ==========================================
router.get("/enquiries", protect, async (req, res) => {
    try {
        const filter = {};
        if (ZONES.includes(req.query.zone)) filter.zone = req.query.zone;
        if (STATUSES.includes(req.query.status)) filter.status = req.query.status;
        const docs = await ZoneEnquiry.find(filter).sort({ createdAt: -1 }).limit(300);
        res.json({ enquiries: docs });
    } catch (error) {
        res.status(500).json({ message: "Unable to load requests." });
    }
});

router.put("/enquiries/:id", protect, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ message: "Request not found." });
        }
        const update = {};
        if (req.body.status !== undefined) {
            if (!STATUSES.includes(req.body.status)) {
                return res.status(400).json({ message: "Invalid status." });
            }
            update.status = req.body.status;
        }
        if (req.body.adminNote !== undefined) update.adminNote = cleanMultiline(req.body.adminNote, 500);

        const doc = await ZoneEnquiry.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!doc) return res.status(404).json({ message: "Request not found." });
        res.json({ enquiry: doc });
    } catch (error) {
        res.status(500).json({ message: "Unable to update request." });
    }
});

// Approve + issue a personal coupon for the requester in one step.
router.post("/enquiries/:id/approve", protect, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ message: "Request not found." });
        }
        const doc = await ZoneEnquiry.findById(req.params.id);
        if (!doc) return res.status(404).json({ message: "Request not found." });

        let couponCode = doc.couponCode;
        const type = req.body.type === "FLAT" ? "FLAT" : "PERCENT";
        const value = Number(req.body.value);

        // A discount is optional (e.g. a corporate enquiry may just be a callback).
        if (value > 0 && !couponCode) {
            if (type === "PERCENT" && value > 100) {
                return res.status(400).json({ message: "Percent discount can't exceed 100." });
            }
            const days = Math.max(1, Math.min(365, parseInt(req.body.validDays, 10) || 60));
            const coupon = await createUniqueCoupon(doc.zone === "student" ? "STU" : "CORP", {
                label: doc.zone === "student" ? "Student Zone discount" : "Corporate Zone discount",
                type,
                value,
                maxDiscount: type === "PERCENT" ? Math.max(0, parseInt(req.body.maxDiscount, 10) || 0) : 0,
                minOrder: Math.max(0, parseInt(req.body.minOrder, 10) || 0),
                source: "ZONE",
                phone: doc.phone,
                maxUses: Math.max(1, Math.min(50, parseInt(req.body.maxUses, 10) || 5)),
                expiresAt: new Date(Date.now() + days * 86400000)
            });
            couponCode = coupon.code;
        }

        doc.status = "Approved";
        doc.couponCode = couponCode;
        if (req.body.adminNote !== undefined) doc.adminNote = cleanMultiline(req.body.adminNote, 500);
        await doc.save();

        res.json({ enquiry: doc });
    } catch (error) {
        console.error("Zone approve failed:", error.message);
        res.status(500).json({ message: "Unable to approve request." });
    }
});

router.delete("/enquiries/:id", protect, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ message: "Request not found." });
        }
        await ZoneEnquiry.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: "Unable to delete request." });
    }
});

module.exports = router;
