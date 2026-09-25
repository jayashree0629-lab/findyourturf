const express = require("express");
const mongoose = require("mongoose");
const Coupon = require("../models/Coupon");
const Booking = require("../models/Booking");
const protect = require("../middleware/authMiddleware");
const { normalisePhone, cleanText } = require("../utils/phone");
const { slotStartMs } = require("../utils/turfPricing");
const {
    CouponError,
    normaliseCode,
    validateCoupon,
    createUniqueCoupon
} = require("../utils/coupons");

const couponRouter = express.Router();
const rewardsRouter = express.Router();

// ---------------------------------------------------------------------------
// REWARDS PROGRAMME
//   1 point per ₹10 paid on a booking, credited once the slot has been played.
//   Points are derived from bookings + redeemed coupons, so there is no
//   separate ledger that can drift out of sync (a cancelled booking simply
//   stops counting).
// ---------------------------------------------------------------------------
const POINT_VALUE_RUPEES = 10;

const REWARD_CATALOG = [
    { id: "flat-50", label: "₹50 off", description: "On any booking of ₹500 or more", type: "FLAT", value: 50, minOrder: 500, points: 150 },
    { id: "flat-150", label: "₹150 off", description: "On any booking of ₹1,000 or more", type: "FLAT", value: 150, minOrder: 1000, points: 400 },
    { id: "flat-300", label: "₹300 off", description: "On any booking of ₹1,500 or more", type: "FLAT", value: 300, minOrder: 1500, points: 750 }
];

const TIERS = [
    { name: "Bronze", min: 0 },
    { name: "Silver", min: 300 },
    { name: "Gold", min: 800 },
    { name: "Platinum", min: 1600 }
];

function tierFor(lifetimePoints) {
    let idx = 0;
    TIERS.forEach((t, i) => {
        if (lifetimePoints >= t.min) idx = i;
    });
    const next = TIERS[idx + 1] || null;
    return {
        name: TIERS[idx].name,
        next: next ? { name: next.name, pointsNeeded: next.min - lifetimePoints, at: next.min } : null,
        floor: TIERS[idx].min
    };
}

function phoneVariants(phone) {
    return [phone, `+91${phone}`, `91${phone}`];
}

async function loadRewards(phone) {
    const now = Date.now();
    const bookings = await Booking.find({
        contactPhone: { $in: phoneVariants(phone) },
        status: { $ne: "Cancelled" }
    }).select("totalAmount bookingDate startTime");

    let earned = 0;
    let pending = 0;
    let completed = 0;
    let totalSpent = 0;
    bookings.forEach((b) => {
        const pts = Math.floor((b.totalAmount || 0) / POINT_VALUE_RUPEES);
        const start = slotStartMs(b);
        if (start != null && start > now) {
            pending += pts;
        } else {
            earned += pts;
            completed += 1;
            totalSpent += b.totalAmount || 0;
        }
    });

    const redeemed = await Coupon.find({ phone, source: "REWARD" }).sort({ createdAt: -1 });
    const spent = redeemed.reduce((s, c) => s + (c.pointsCost || 0), 0);

    return { earned, pending, spent, completed, totalSpent, redeemed, balance: Math.max(0, earned - spent) };
}

rewardsRouter.get("/summary", async (req, res) => {
    try {
        const phone = normalisePhone(req.query.phone);
        if (!phone) return res.status(400).json({ message: "Enter a valid mobile number." });

        const r = await loadRewards(phone);
        res.json({
            points: r.balance,
            lifetimePoints: r.earned,
            pendingPoints: r.pending,
            redeemedPoints: r.spent,
            completedBookings: r.completed,
            totalSpent: r.totalSpent,
            tier: tierFor(r.earned),
            tiers: TIERS,
            pointValueRupees: POINT_VALUE_RUPEES,
            catalog: REWARD_CATALOG,
            coupons: r.redeemed.map((c) => ({
                code: c.code,
                label: c.label,
                usedCount: c.usedCount,
                used: c.usedBy.includes(phone),
                expiresAt: c.expiresAt,
                pointsCost: c.pointsCost
            }))
        });
    } catch (error) {
        console.error("Rewards summary failed:", error.message);
        res.status(500).json({ message: "Unable to load your rewards." });
    }
});

rewardsRouter.post("/redeem", async (req, res) => {
    try {
        const phone = normalisePhone(req.body.phone);
        if (!phone) return res.status(400).json({ message: "Enter a valid mobile number." });

        const item = REWARD_CATALOG.find((c) => c.id === req.body.rewardId);
        if (!item) return res.status(404).json({ message: "That reward isn't available." });

        const r = await loadRewards(phone);
        if (r.balance < item.points) {
            return res.status(400).json({
                message: `You need ${item.points - r.balance} more points for this reward.`
            });
        }

        const coupon = await createUniqueCoupon("RWD", {
            label: `Rewards · ${item.label}`,
            type: item.type,
            value: item.value,
            minOrder: item.minOrder,
            source: "REWARD",
            phone,
            pointsCost: item.points,
            maxUses: 1,
            expiresAt: new Date(Date.now() + 90 * 86400000)
        });

        res.status(201).json({
            coupon: { code: coupon.code, label: coupon.label, expiresAt: coupon.expiresAt },
            points: r.balance - item.points
        });
    } catch (error) {
        console.error("Reward redeem failed:", error.message);
        res.status(500).json({ message: "Unable to redeem right now." });
    }
});

// ---------------------------------------------------------------------------
// COUPONS - PLAYER
// ---------------------------------------------------------------------------
couponRouter.post("/validate", async (req, res) => {
    try {
        const phone = normalisePhone(req.body.phone);
        const subtotal = Number(req.body.subtotal);
        if (!phone) return res.status(400).json({ message: "Add your mobile number before using a coupon." });
        if (!(subtotal > 0)) return res.status(400).json({ message: "Nothing to discount yet." });

        const { coupon, discount } = await validateCoupon({ code: req.body.code, phone, subtotal });
        res.json({
            code: coupon.code,
            label: coupon.label,
            discount,
            total: subtotal - discount
        });
    } catch (error) {
        if (error instanceof CouponError) return res.status(400).json({ message: error.message });
        res.status(500).json({ message: "Couldn't check that coupon. Try again." });
    }
});

// Coupons issued to a phone number (rewards, zone approvals, admin gifts).
couponRouter.get("/mine", async (req, res) => {
    try {
        const phone = normalisePhone(req.query.phone);
        if (!phone) return res.json({ coupons: [] });
        const now = new Date();
        const docs = await Coupon.find({
            phone,
            active: true,
            $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }]
        }).sort({ createdAt: -1 });

        res.json({
            coupons: docs
                .filter((c) => !c.usedBy.includes(phone) && (c.maxUses === 0 || c.usedCount < c.maxUses))
                .map((c) => ({
                    code: c.code,
                    label: c.label,
                    type: c.type,
                    value: c.value,
                    minOrder: c.minOrder,
                    maxDiscount: c.maxDiscount,
                    source: c.source,
                    expiresAt: c.expiresAt
                }))
        });
    } catch (error) {
        res.status(500).json({ message: "Unable to load your coupons." });
    }
});

// ---------------------------------------------------------------------------
// COUPONS - ADMIN
// ---------------------------------------------------------------------------
couponRouter.get("/", protect, async (req, res) => {
    try {
        const docs = await Coupon.find().sort({ createdAt: -1 }).limit(500);
        res.json({ coupons: docs });
    } catch (error) {
        res.status(500).json({ message: "Unable to load coupons." });
    }
});

couponRouter.post("/", protect, async (req, res) => {
    try {
        const type = req.body.type === "FLAT" ? "FLAT" : "PERCENT";
        const value = Number(req.body.value);
        if (!(value > 0)) return res.status(400).json({ message: "Enter a discount value." });
        if (type === "PERCENT" && value > 100) {
            return res.status(400).json({ message: "Percent discount can't exceed 100." });
        }

        const phone = req.body.phone ? normalisePhone(req.body.phone) : "";
        if (req.body.phone && !phone) {
            return res.status(400).json({ message: "Restrict-to phone number is invalid." });
        }

        let expiresAt = null;
        if (req.body.expiresAt) {
            expiresAt = new Date(req.body.expiresAt);
            if (Number.isNaN(expiresAt.getTime())) {
                return res.status(400).json({ message: "Expiry date is invalid." });
            }
            expiresAt.setHours(23, 59, 59, 999);
        }

        const fields = {
            label: cleanText(req.body.label, 80),
            type,
            value,
            maxDiscount: type === "PERCENT" ? Math.max(0, parseInt(req.body.maxDiscount, 10) || 0) : 0,
            minOrder: Math.max(0, parseInt(req.body.minOrder, 10) || 0),
            source: "ADMIN",
            phone,
            maxUses: Math.max(0, parseInt(req.body.maxUses, 10) || 0),
            expiresAt
        };

        const customCode = normaliseCode(req.body.code);
        let coupon;
        if (customCode) {
            if (!/^[A-Z0-9_-]{3,20}$/.test(customCode)) {
                return res.status(400).json({ message: "Code must be 3-20 letters, numbers, - or _." });
            }
            try {
                coupon = await Coupon.create({ ...fields, code: customCode });
            } catch (err) {
                if (err.code === 11000) return res.status(409).json({ message: "That code already exists." });
                throw err;
            }
        } else {
            coupon = await createUniqueCoupon("TH", fields);
        }
        res.status(201).json({ coupon });
    } catch (error) {
        console.error("Coupon create failed:", error.message);
        res.status(500).json({ message: "Unable to create coupon." });
    }
});

couponRouter.put("/:id", protect, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ message: "Coupon not found." });
        }
        const update = {};
        if (typeof req.body.active === "boolean") update.active = req.body.active;
        const doc = await Coupon.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!doc) return res.status(404).json({ message: "Coupon not found." });
        res.json({ coupon: doc });
    } catch (error) {
        res.status(500).json({ message: "Unable to update coupon." });
    }
});

couponRouter.delete("/:id", protect, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ message: "Coupon not found." });
        }
        await Coupon.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: "Unable to delete coupon." });
    }
});

module.exports = { couponRouter, rewardsRouter };
