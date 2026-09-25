const express = require("express");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Turf = require("../models/Turf");
const User = require("../models/User");
const AddonBooking = require("../models/AddonBooking");
const protect = require("../middleware/authMiddleware");
const { computeBookingPrice, slotStartMs } = require("../utils/turfPricing");
const { resolveAddons } = require("../utils/addonPricing");
const { normalisePhone } = require("../utils/phone");
const Coupon = require("../models/Coupon");
const { validateCoupon, consumeCoupon, releaseCoupon } = require("../utils/coupons");

const router = express.Router();

// Players can cancel themselves up to this many hours before the slot starts.
const SELF_CANCEL_WINDOW_HOURS = 2;

// Shared by the player and admin cancel paths: frees add-ons, gives back a
// used coupon, tells connected clients the slot is open again.
async function applyCancellation(req, booking) {
    booking.status = "Cancelled";
    const saved = await booking.save();

    await AddonBooking.updateMany(
        { booking: booking._id, status: { $ne: "Cancelled" } },
        { $set: { status: "Cancelled" } }
    );

    if (booking.couponCode) {
        const coupon = await Coupon.findOne({ code: booking.couponCode });
        const phone = normalisePhone(booking.contactPhone) || booking.contactPhone;
        if (coupon) await releaseCoupon(coupon, phone).catch(() => {});
    }

    emit(req, "booking:cancelled", {
        _id: booking._id,
        turf: String(booking.turf),
        bookingDate: booking.bookingDate.toISOString(),
        startTime: booking.startTime
    });

    return saved;
}

// Link an existing User if one already matches the contact details. The player
// app has no login, so we never create accounts here — the booking's contact
// snapshot (name / phone / email) is the source of truth.
async function linkUser({ user, phone, email }) {
    try {
        if (user && mongoose.Types.ObjectId.isValid(user)) {
            const byId = await User.findById(user);
            if (byId) return byId._id;
        }
        const cleanEmail = (email || "").trim().toLowerCase();
        const cleanPhone = (phone || "").trim();
        const match =
            (cleanEmail && (await User.findOne({ email: cleanEmail }))) ||
            (cleanPhone && (await User.findOne({ phone: cleanPhone })));
        return match ? match._id : null;
    } catch {
        return null;
    }
}

function emit(req, event, payload) {
    const io = req.app.get("io");
    if (io) io.emit(event, payload);
}


// ==========================================
// GET BOOKED SLOTS FOR A TURF ON A DATE - PUBLIC
// Returns the list of startTimes already taken so the
// client can grey them out. Used by the booking screen.
// ==========================================
router.get("/booked-slots", async (req, res) => {
    try {
        const { turf, date } = req.query;

        if (!turf || !date) {
            return res.status(400).json({
                message: "turf and date are required"
            });
        }

        const day = new Date(date);
        const nextDay = new Date(day);
        nextDay.setDate(day.getDate() + 1);

        const bookings = await Booking.find({
            turf,
            bookingDate: { $gte: day, $lt: nextDay },
            status: { $ne: "Cancelled" }
        }).select("startTime endTime");

        res.json({
            bookedSlots: bookings.map((b) => b.startTime),
            bookings
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});


// ==========================================
// CHECK TURF AVAILABILITY - PUBLIC
// ==========================================
router.get("/availability", async (req, res) => {
    try {
        const {
            turf,
            bookingDate,
            startTime,
            endTime
        } = req.query;

        if (!turf || !bookingDate || !startTime || !endTime) {
            return res.status(400).json({
                message: "turf, bookingDate, startTime and endTime are required"
            });
        }

        const existingBooking = await Booking.findOne({
            turf,
            bookingDate: new Date(bookingDate),
            status: { $ne: "Cancelled" },
            startTime
        });

        if (existingBooking) {
            return res.json({
                available: false,
                message: "Turf is already booked for this time."
            });
        }

        res.json({
            available: true,
            message: "Turf is available."
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});


// ==========================================
// PRICE QUOTE - PUBLIC
// Returns the authoritative price breakdown + split (no booking is made).
// ==========================================
router.post("/quote", async (req, res) => {
    try {
        const { turf, players, useFloodlight, equipment, addons, date, startTime } = req.body;

        const turfDoc = await Turf.findById(turf);
        if (!turfDoc) {
            return res.status(404).json({ message: "Turf not found" });
        }
        if (turfDoc.pricePerHour == null || turfDoc.pricePerHour <= 0) {
            return res.status(400).json({
                message: "Online pricing for this turf is not available yet. Please contact the venue to book.",
                pricingUnavailable: true,
                contactNumber: turfDoc.contactNumber || ""
            });
        }

        let addonLines = [];
        try {
            const resolved = await resolveAddons(addons, { date, startTime });
            addonLines = resolved.lines;
        } catch (e) {
            return res.status(e.status || 400).json({ message: e.message || "An add-on is unavailable." });
        }

        const price = computeBookingPrice(turfDoc, {
            players,
            useFloodlight,
            equipment,
            addonLines
        });

        res.json({ turf: turfDoc._id, ...price });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// ==========================================
// MY BOOKINGS - PUBLIC (by contact email / phone)
// ==========================================
router.get("/mine", async (req, res) => {
    try {
        const { email, phone } = req.query;
        const or = [];
        if (email) or.push({ contactEmail: String(email).trim().toLowerCase() });
        if (phone) {
            const rawPhone = String(phone).trim();
            const normalised = normalisePhone(rawPhone);
            or.push({ contactPhone: { $in: [...new Set([rawPhone, normalised].filter(Boolean))] } });
        }

        if (or.length === 0) {
            return res.json({ bookings: [] });
        }

        const bookings = await Booking.find({ $or: or })
            .populate("turf")
            .sort({ createdAt: -1 });

        const ids = bookings.map((b) => b._id);
        const addons = await AddonBooking.find({ booking: { $in: ids } }).lean();
        const byBooking = {};
        addons.forEach((a) => {
            (byBooking[String(a.booking)] = byBooking[String(a.booking)] || []).push(a);
        });

        const now = Date.now();
        res.json({
            cancelWindowHours: SELF_CANCEL_WINDOW_HOURS,
            bookings: bookings.map((b) => {
                const start = slotStartMs(b);
                return {
                    ...b.toObject(),
                    addons: byBooking[String(b._id)] || [],
                    startsAt: start != null ? new Date(start).toISOString() : null,
                    isPast: start != null ? start < now : false,
                    canCancel:
                        b.status !== "Cancelled" &&
                        start != null &&
                        (start - now) / 3600000 >= SELF_CANCEL_WINDOW_HOURS
                };
            })
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// ==========================================
// CREATE BOOKING - PUBLIC
// The price is always recomputed on the server from the Turf record.
// ==========================================
router.post("/", async (req, res) => {
    try {
        const {
            user,
            turf,
            bookingDate,
            startTime,
            endTime,
            players,
            useFloodlight,
            equipment,
            addons,
            contact = {},
            paymentMethod,
            paymentPlan = "full",
            splitMembers = [],
            couponCode,
            status
        } = req.body;

        if (!turf || !bookingDate || !startTime || !endTime) {
            return res.status(400).json({
                message: "turf, bookingDate, startTime and endTime are required"
            });
        }

        const turfDoc = await Turf.findById(turf);
        if (!turfDoc) {
            return res.status(404).json({ message: "Turf not found" });
        }
        if (turfDoc.pricePerHour == null || turfDoc.pricePerHour <= 0) {
            return res.status(400).json({
                message: "Online booking for this turf is not available yet. Please contact the venue directly.",
                pricingUnavailable: true,
                contactNumber: turfDoc.contactNumber || ""
            });
        }

        // --- Double-booking guard: same turf, same day, same start slot ---
        const day = new Date(bookingDate);
        const nextDay = new Date(day);
        nextDay.setDate(day.getDate() + 1);

        const clash = await Booking.findOne({
            turf,
            bookingDate: { $gte: day, $lt: nextDay },
            status: { $ne: "Cancelled" },
            startTime
        });

        if (clash) {
            return res.status(409).json({
                message: "This slot was just booked by someone else. Please pick another time."
            });
        }

        if (!contact || !String(contact.name || "").trim() || !String(contact.phone || "").trim()) {
            return res.status(400).json({ message: "Your name and phone number are required to book." });
        }

        // --- Resolve + validate add-ons (availability + stock) BEFORE writing ---
        let addonLines = [];
        try {
            const resolved = await resolveAddons(addons, { date: day, startTime });
            addonLines = resolved.lines;
        } catch (e) {
            return res.status(e.status || 400).json({ message: e.message || "An add-on is unavailable." });
        }

        const price = computeBookingPrice(turfDoc, { players, useFloodlight, equipment, addonLines });

        const linkedUserId = await linkUser({
            user,
            phone: contact.phone,
            email: contact.email
        });

        const contactName = String(contact.name || "").trim();
        const contactPhone = normalisePhone(contact.phone) || String(contact.phone || "").trim();
        const contactEmail = String(contact.email || "").trim().toLowerCase();

        const normalizedSplitMembers = paymentPlan === "split"
            ? splitMembers
                .filter((member) => member && String(member.phone || "").trim())
                .map((member) => ({
                    name: String(member.name || "").trim(),
                    phone: String(member.phone).trim(),
                    gpayNumber: String(member.gpayNumber || "").trim(),
                    sendMethod: member.sendMethod === "gpay" ? "gpay" : "sms",
                    paid: false
                }))
            : [];
        const isSplit = paymentPlan === "split";
        if (isSplit && normalizedSplitMembers.length !== Math.max(0, price.players - 1)) {
            return res.status(400).json({
                message: `Split payment needs ${Math.max(0, price.players - 1)} teammate phone number(s).`
            });
        }

        // --- Coupon: validated and atomically claimed BEFORE the booking is
        // written, then given back if anything below fails.
        let discountAmount = 0;
        let appliedCoupon = null;
        const cleanCouponCode = String(couponCode || "").trim();
        if (cleanCouponCode) {
            try {
                const { coupon, discount } = await validateCoupon({
                    code: cleanCouponCode,
                    phone: contactPhone,
                    subtotal: price.totalAmount
                });
                if (!(await consumeCoupon(coupon, contactPhone))) {
                    return res.status(409).json({ message: "This coupon was just used. Please remove it and try again." });
                }
                appliedCoupon = coupon;
                discountAmount = discount;
            } catch (e) {
                return res.status(e.status || 400).json({ message: e.message });
            }
        }
        const finalTotal = price.totalAmount - discountAmount;
        const finalPerPerson = Math.ceil(finalTotal / price.players);

        let booking;
        try {
        booking = await Booking.create({
            user: linkedUserId,
            turf,
            bookingDate: day,
            startTime,
            endTime,
            players: price.players,
            perPersonAmount: finalPerPerson,
            baseAmount: price.baseAmount,
            floodlightApplied: price.floodlightApplied,
            floodlightAmount: price.floodlightAmount,
            equipmentSelected: price.equipmentSelected,
            equipmentAmount: price.equipmentAmount,
            addonsAmount: price.addonsAmount,
            couponCode: appliedCoupon ? appliedCoupon.code : "",
            discountAmount,
            totalAmount: finalTotal,
            contactName,
            contactPhone,
            contactEmail,
            paymentMethod: paymentMethod || "UPI",
            paymentPlan: isSplit ? "split" : "full",
            splitMembers: normalizedSplitMembers,
            splitPaymentStatus: isSplit ? "Pending" : "NotApplicable",
            status: isSplit || status === "Pending" ? "Pending" : "Confirmed"
        });
        } catch (createErr) {
            if (appliedCoupon) await releaseCoupon(appliedCoupon, contactPhone).catch(() => {});
            throw createErr;
        }

        // --- Persist each add-on. Roll the whole booking back on any failure. ---
        let addonDocs = [];
        try {
            if (addonLines.length) {
                addonDocs = await AddonBooking.insertMany(
                    addonLines.map((l) => ({
                        user: linkedUserId,
                        turf,
                        booking: booking._id,
                        service: l.serviceId,
                        type: l.type,
                        serviceName: l.name,
                        bookingDate: day,
                        startTime,
                        endTime: endTime || startTime,
                        unitPrice: l.unitPrice,
                        quantity: l.quantity,
                        lineTotal: l.lineTotal,
                        contactName,
                        contactPhone,
                        contactEmail,
                        status: "Confirmed"
                    }))
                );
            }
        } catch (e) {
            await AddonBooking.deleteMany({ booking: booking._id });
            await Booking.deleteOne({ _id: booking._id });
            if (appliedCoupon) await releaseCoupon(appliedCoupon, contactPhone).catch(() => {});
            return res.status(500).json({ message: "Could not attach add-ons: " + e.message });
        }

        const populated = await booking.populate("turf");

        emit(req, "booking:created", {
            _id: booking._id,
            turf: String(turf),
            bookingDate: day.toISOString(),
            startTime
        });

        if (addonDocs.length) {
            emit(req, "addon:booked", { booking: String(booking._id), turf: String(turf), bookingDate: day.toISOString(), startTime });
        }

        res.status(201).json({
            message: "Booking created successfully",
            booking: populated,
            addons: addonDocs
        });

        // Mark one invited split member as paid. The booking stays Pending until every
        // invited member has paid, then transitions atomically to Confirmed.
        router.post("/:id/split-payments", async (req, res) => {
            try {
                const phone = String(req.body?.phone || "").trim();
                if (!phone) return res.status(400).json({ message: "Member phone is required." });

                const booking = await Booking.findById(req.params.id);
                if (!booking) return res.status(404).json({ message: "Booking not found." });
                if (booking.paymentPlan !== "split") {
                    return res.status(400).json({ message: "This booking does not use split payment." });
                }

                const member = booking.splitMembers.find((entry) => entry.phone === phone);
                if (!member) return res.status(404).json({ message: "Split member not found." });

                member.paid = true;
                member.paidAt = new Date();
                const everyonePaid = booking.splitMembers.length > 0 && booking.splitMembers.every((entry) => entry.paid);
                booking.splitPaymentStatus = everyonePaid ? "Completed" : "Pending";
                booking.status = everyonePaid ? "Confirmed" : "Pending";
                await booking.save();

                emit(req, "booking:split-payment", {
                    booking: String(booking._id),
                    phone,
                    status: booking.status,
                    splitPaymentStatus: booking.splitPaymentStatus
                });
                res.json({ booking });
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});


// ==========================================
// GET ALL BOOKINGS - ADMIN ONLY
// ==========================================
router.get("/", protect, async (req, res) => {
    try {
        const bookings = await Booking.find()
            .populate("user")
            .populate("turf")
            .sort({ createdAt: -1 });

        res.status(200).json(bookings);

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});


// ==========================================
// GET SINGLE BOOKING - ADMIN ONLY
// ==========================================
router.get("/:id", protect, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate("user")
            .populate("turf");

        if (!booking) {
            return res.status(404).json({
                message: "Booking not found"
            });
        }

        const addons = await AddonBooking.find({ booking: booking._id }).populate("service", "name type");
        res.status(200).json({ ...booking.toObject(), addons });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});


// ==========================================
// CANCEL BOOKING - ADMIN ONLY
// ==========================================
router.put("/:id/cancel", protect, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({
                message: "Booking not found"
            });
        }

        // Frees add-ons (photographer/coach slots, equipment stock) and gives
        // back any coupon that was used.
        const updatedBooking = await applyCancellation(req, booking);

        res.json({
            message: "Booking cancelled successfully",
            booking: updatedBooking
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});


// ==========================================
// CONFIRM A PENDING BOOKING - ADMIN ONLY
// ==========================================
router.put("/:id/confirm", protect, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }
        if (booking.status === "Cancelled") {
            return res.status(400).json({ message: "A cancelled booking can't be confirmed." });
        }
        booking.status = "Confirmed";
        await booking.save();
        res.json({ message: "Booking confirmed", booking });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// ==========================================
// CANCEL MY BOOKING - PUBLIC (verified by the booking's phone number)
// Allowed until SELF_CANCEL_WINDOW_HOURS before the slot starts.
// ==========================================
router.put("/:id/cancel-mine", async (req, res) => {
    try {
        const phone = normalisePhone(req.body && req.body.phone);
        if (!phone) {
            return res.status(400).json({ message: "Enter the mobile number used for this booking." });
        }
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ message: "Booking not found" });
        }

        const booking = await Booking.findById(req.params.id);
        // Same message for "not found" and "not yours" so ids can't be probed.
        if (!booking || (normalisePhone(booking.contactPhone) || booking.contactPhone) !== phone) {
            return res.status(404).json({ message: "Booking not found for this mobile number." });
        }
        if (booking.status === "Cancelled") {
            return res.status(400).json({ message: "This booking is already cancelled." });
        }

        const start = slotStartMs(booking);
        if (start != null) {
            const hoursLeft = (start - Date.now()) / 3600000;
            if (hoursLeft < 0) {
                return res.status(400).json({ message: "This booking is already in the past." });
            }
            if (hoursLeft < SELF_CANCEL_WINDOW_HOURS) {
                return res.status(400).json({
                    message: `Bookings can only be cancelled online up to ${SELF_CANCEL_WINDOW_HOURS} hours before the slot. Please call the venue.`
                });
            }
        }

        const saved = await applyCancellation(req, booking);
        res.json({ message: "Booking cancelled. The slot is open for others again.", booking: saved });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


module.exports = router;
