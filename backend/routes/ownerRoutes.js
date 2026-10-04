const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const Turf = require("../models/Turf");
const Booking = require("../models/Booking");
const AddonBooking = require("../models/AddonBooking");
const TurfOwner = require("../models/TurfOwner");
const OwnerNotification = require("../models/OwnerNotification");
const protect = require("../middleware/authMiddleware");
const { normalisePhone, cleanText } = require("../utils/phone");
const { paymentSummary } = require("../utils/payments");
const { slotStartMs } = require("../utils/turfPricing");

// Two routers: admin management (/api/owners) and the owner's own read-only
// portal (/api/owner-portal), which is protected only by its secret token.
const adminRouter = express.Router();
const portalRouter = express.Router();

const isId = (id) => mongoose.Types.ObjectId.isValid(id);

function whatsappUrl(phone, text) {
    const digits = normalisePhone(phone);
    if (!digits) return "";
    return `https://wa.me/91${digits}?text=${encodeURIComponent(text)}`;
}

function shapeNotification(n) {
    return {
        _id: n._id,
        kind: n.kind,
        title: n.title,
        message: n.message,
        status: n.status,
        sentAt: n.sentAt,
        createdAt: n.createdAt,
        webhookDelivered: n.webhookDelivered,
        turfId: n.turf && n.turf._id ? n.turf._id : n.turf,
        turfName: n.turf && n.turf.name ? n.turf.name : "",
        ownerName: n.ownerName,
        ownerPhone: n.ownerPhone,
        hasOwner: Boolean(n.ownerPhone),
        whatsappUrl: whatsappUrl(n.ownerPhone, n.message)
    };
}

// ==========================================
// ADMIN: owners (one per turf)
// ==========================================
adminRouter.get("/", protect, async (req, res) => {
    try {
        const owners = await TurfOwner.find();
        res.json({
            owners: owners.map((o) => ({
                turfId: o.turf,
                name: o.name,
                phone: o.phone,
                email: o.email,
                accessToken: o.accessToken
            }))
        });
    } catch (error) {
        res.status(500).json({ message: "Unable to load turf owners." });
    }
});

adminRouter.put("/turf/:turfId", protect, async (req, res) => {
    try {
        if (!isId(req.params.turfId)) return res.status(404).json({ message: "Turf not found." });
        const turf = await Turf.findById(req.params.turfId);
        if (!turf) return res.status(404).json({ message: "Turf not found." });

        const name = cleanText(req.body.name, 80);
        const phone = normalisePhone(req.body.phone);
        const email = cleanText(req.body.email, 100).toLowerCase();
        if (!name) return res.status(400).json({ message: "Owner name is required." });
        if (!phone) return res.status(400).json({ message: "Enter a valid 10-digit owner mobile number." });
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ message: "Enter a valid owner email or leave it blank." });
        }

        const owner = await TurfOwner.findOneAndUpdate(
            { turf: turf._id },
            { $set: { name, phone, email }, $setOnInsert: { accessToken: crypto.randomBytes(18).toString("hex") } },
            { new: true, upsert: true }
        );
        res.json({
            owner: { turfId: owner.turf, name: owner.name, phone: owner.phone, email: owner.email, accessToken: owner.accessToken }
        });
    } catch (error) {
        console.error("Owner save failed:", error.message);
        res.status(500).json({ message: "Unable to save owner details." });
    }
});

adminRouter.post("/turf/:turfId/regenerate-link", protect, async (req, res) => {
    try {
        if (!isId(req.params.turfId)) return res.status(404).json({ message: "Turf not found." });
        const owner = await TurfOwner.findOneAndUpdate(
            { turf: req.params.turfId },
            { accessToken: crypto.randomBytes(18).toString("hex") },
            { new: true }
        );
        if (!owner) return res.status(404).json({ message: "Add the owner's details first." });
        res.json({ accessToken: owner.accessToken });
    } catch (error) {
        res.status(500).json({ message: "Unable to reset the link." });
    }
});

adminRouter.delete("/turf/:turfId", protect, async (req, res) => {
    try {
        if (!isId(req.params.turfId)) return res.status(404).json({ message: "Turf not found." });
        await TurfOwner.deleteOne({ turf: req.params.turfId });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: "Unable to remove the owner." });
    }
});

// ==========================================
// ADMIN: notification outbox
// ==========================================
adminRouter.get("/notifications", protect, async (req, res) => {
    try {
        const filter = {};
        if (req.query.status === "Pending" || req.query.status === "Sent") filter.status = req.query.status;
        if (req.query.turf && isId(req.query.turf)) filter.turf = req.query.turf;
        const docs = await OwnerNotification.find(filter).populate("turf", "name").sort({ createdAt: -1 }).limit(300);
        const pending = await OwnerNotification.countDocuments({ status: "Pending" });
        res.json({ notifications: docs.map(shapeNotification), pending });
    } catch (error) {
        res.status(500).json({ message: "Unable to load owner alerts." });
    }
});

adminRouter.put("/notifications/:id/sent", protect, async (req, res) => {
    try {
        if (!isId(req.params.id)) return res.status(404).json({ message: "Alert not found." });
        const doc = await OwnerNotification.findByIdAndUpdate(
            req.params.id,
            { status: "Sent", sentAt: new Date() },
            { new: true }
        );
        if (!doc) return res.status(404).json({ message: "Alert not found." });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: "Unable to update the alert." });
    }
});

adminRouter.post("/notifications/mark-all-sent", protect, async (req, res) => {
    try {
        const result = await OwnerNotification.updateMany(
            { status: "Pending" },
            { status: "Sent", sentAt: new Date() }
        );
        res.json({ updated: result.modifiedCount });
    } catch (error) {
        res.status(500).json({ message: "Unable to update the alerts." });
    }
});

// ==========================================
// OWNER PORTAL (token only)
// ==========================================
portalRouter.get("/:token", async (req, res) => {
    try {
        const token = String(req.params.token || "");
        if (!/^[a-f0-9]{20,64}$/.test(token)) return res.status(404).json({ message: "This link isn't valid." });

        const owner = await TurfOwner.findOne({ accessToken: token });
        if (!owner) return res.status(404).json({ message: "This link isn't valid or was reset." });
        const turf = await Turf.findById(owner.turf).select("name location address contactNumber");
        if (!turf) return res.status(404).json({ message: "This turf no longer exists." });

        const bookings = await Booking.find({ turf: turf._id }).sort({ bookingDate: -1, createdAt: -1 }).limit(300);
        const ids = bookings.map((b) => b._id);
        const addons = await AddonBooking.find({ booking: { $in: ids }, status: { $ne: "Cancelled" } }).lean();
        const addonsBy = {};
        addons.forEach((a) => {
            (addonsBy[String(a.booking)] = addonsBy[String(a.booking)] || []).push(`${a.serviceName}${a.quantity > 1 ? ` ×${a.quantity}` : ""}`);
        });

        const now = Date.now();
        const rows = bookings.map((b) => {
            const start = slotStartMs(b);
            return {
                _id: b._id,
                ref: `FYT-${String(b._id).slice(-6).toUpperCase()}`,
                bookingDate: b.bookingDate,
                startTime: b.startTime,
                endTime: b.endTime,
                startsAt: start != null ? new Date(start).toISOString() : null,
                isPast: start != null ? start < now : false,
                status: b.status,
                playerName: b.contactName,
                playerPhone: b.contactPhone,
                players: b.players,
                totalAmount: b.totalAmount,
                perPersonAmount: b.perPersonAmount,
                paymentMethod: b.paymentMethod,
                paymentPlan: b.paymentPlan,
                couponCode: b.couponCode,
                discountAmount: b.discountAmount,
                addons: addonsBy[String(b._id)] || [],
                splitMembers: (b.splitMembers || []).map((m) => ({
                    name: m.name,
                    phone: m.phone,
                    paid: m.paid,
                    paidAt: m.paidAt
                })),
                payment: paymentSummary(b),
                createdAt: b.createdAt
            };
        });

        const active = rows.filter((r) => r.status !== "Cancelled");
        const notifications = await OwnerNotification.find({ turf: turf._id }).sort({ createdAt: -1 }).limit(40);

        res.json({
            turf: { name: turf.name, location: turf.location, address: turf.address },
            owner: { name: owner.name },
            stats: {
                upcoming: active.filter((r) => !r.isPast).length,
                pendingPayments: active.filter((r) => r.payment.amountPending > 0 && !r.isPast).length,
                pendingAmount: active.filter((r) => !r.isPast).reduce((s, r) => s + r.payment.amountPending, 0),
                collected: active.reduce((s, r) => s + r.payment.amountPaid, 0),
                totalBookings: active.length
            },
            bookings: rows,
            notifications: notifications.map((n) => ({
                _id: n._id,
                kind: n.kind,
                title: n.title,
                message: n.message,
                createdAt: n.createdAt
            }))
        });
    } catch (error) {
        console.error("Owner portal failed:", error.message);
        res.status(500).json({ message: "Unable to load bookings right now." });
    }
});

module.exports = { adminRouter, portalRouter };
