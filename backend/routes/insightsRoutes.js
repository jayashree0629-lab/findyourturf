const express = require("express");
const Booking = require("../models/Booking");
const Turf = require("../models/Turf");
const Visitor = require("../models/Visitor");
const PlayerRequest = require("../models/PlayerRequest");
const ZoneEnquiry = require("../models/ZoneEnquiry");
const ChatMessage = require("../models/ChatMessage");
const CommunityPost = require("../models/CommunityPost");
const Coupon = require("../models/Coupon");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

const DAY = 86400000;
const TZ = "Asia/Kolkata";

// YYYY-MM-DD for a moment in time, as seen in Coimbatore.
const istDay = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: TZ });

// ==========================================
// ADMIN BUSINESS SUMMARY
// ==========================================
router.get("/summary", protect, async (req, res) => {
    try {
        const now = new Date();
        // Booking dates are stored as a calendar day at UTC midnight, so "today"
        // is today's date in Coimbatore expressed the same way.
        const todayUTC = new Date(`${istDay(now)}T00:00:00Z`);
        // "Sales" chart covers the last 7 local days, bucketed by when the booking was made.
        const salesDays = Array.from({ length: 7 }, (_, i) => istDay(Date.now() - (6 - i) * DAY));
        const weekStart = new Date(Date.now() - 7 * DAY);
        const dayAgo = new Date(Date.now() - DAY);
        const active = { status: { $ne: "Cancelled" } };

        const [
            totalBookings,
            todayBookings,
            upcomingBookings,
            pendingBookings,
            cancelledBookings,
            revenueAgg,
            weekAgg,
            topTurfsAgg,
            visitorsTotal,
            visitorsWeek,
            openEnquiries,
            openPlayerRequests,
            messages24h,
            posts,
            activeCoupons
        ] = await Promise.all([
            Booking.countDocuments(),
            Booking.countDocuments({ ...active, bookingDate: { $gte: todayUTC, $lt: new Date(todayUTC.getTime() + DAY) } }),
            Booking.countDocuments({ ...active, bookingDate: { $gte: todayUTC } }),
            Booking.countDocuments({ status: "Pending" }),
            Booking.countDocuments({ status: "Cancelled" }),
            Booking.aggregate([
                { $match: active },
                { $group: { _id: null, revenue: { $sum: "$totalAmount" }, discounts: { $sum: "$discountAmount" } } }
            ]),
            Booking.aggregate([
                { $match: { ...active, createdAt: { $gte: weekStart } } },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: TZ } },
                        bookings: { $sum: 1 },
                        revenue: { $sum: "$totalAmount" }
                    }
                }
            ]),
            Booking.aggregate([
                { $match: active },
                { $group: { _id: "$turf", bookings: { $sum: 1 }, revenue: { $sum: "$totalAmount" } } },
                { $sort: { revenue: -1 } },
                { $limit: 5 },
                { $lookup: { from: Turf.collection.name, localField: "_id", foreignField: "_id", as: "turf" } }
            ]),
            Visitor.countDocuments(),
            Visitor.countDocuments({ createdAt: { $gte: weekStart } }),
            ZoneEnquiry.countDocuments({ status: { $in: ["New", "In Review"] } }),
            PlayerRequest.countDocuments({ status: { $in: ["Open", "Full"] }, date: { $gte: todayUTC } }),
            ChatMessage.countDocuments({ deleted: false, createdAt: { $gte: dayAgo } }),
            CommunityPost.countDocuments({ hidden: false }),
            Coupon.countDocuments({
                active: true,
                $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }]
            })
        ]);

        const byDay = Object.fromEntries(weekAgg.map((d) => [d._id, d]));
        const week = salesDays.map((key) => ({
            date: key,
            bookings: byDay[key] ? byDay[key].bookings : 0,
            revenue: byDay[key] ? byDay[key].revenue : 0
        }));

        res.json({
            bookings: {
                total: totalBookings,
                today: todayBookings,
                upcoming: upcomingBookings,
                pending: pendingBookings,
                cancelled: cancelledBookings
            },
            revenue: {
                total: revenueAgg[0] ? revenueAgg[0].revenue : 0,
                discountsGiven: revenueAgg[0] ? revenueAgg[0].discounts : 0
            },
            week,
            topTurfs: topTurfsAgg.map((t) => ({
                turfId: t._id,
                name: t.turf[0] ? t.turf[0].name : "Removed turf",
                bookings: t.bookings,
                revenue: t.revenue
            })),
            visitors: { total: visitorsTotal, thisWeek: visitorsWeek },
            community: { openEnquiries, openPlayerRequests, messages24h, posts, activeCoupons }
        });
    } catch (error) {
        console.error("Insights summary failed:", error.message);
        res.status(500).json({ message: "Unable to load the business summary." });
    }
});

module.exports = router;
