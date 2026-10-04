const TurfOwner = require("../models/TurfOwner");
const OwnerNotification = require("../models/OwnerNotification");
const { paymentSummary } = require("./payments");

const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const ref = (b) => `FYT-${String(b._id).slice(-6).toUpperCase()}`;

function when(booking) {
    const d = new Date(booking.bookingDate).toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC"
    });
    const t =
        booking.endTime && booking.endTime !== booking.startTime
            ? `${booking.startTime} – ${booking.endTime}`
            : booking.startTime;
    return `${d}, ${t}`;
}

function payLine(booking) {
    const p = paymentSummary(booking);
    if (p.mode === "split") {
        const names = (booking.splitMembers || [])
            .filter((m) => !m.paid)
            .map((m) => `${m.name || "Teammate"} (${m.phone})`)
            .join(", ");
        return (
            `Split payment: ${p.membersPaid + 1}/${p.membersTotal + 1} players paid ${rupees(p.share)} each. ` +
            `Paid ${rupees(p.amountPaid)}, pending ${rupees(p.amountPending)}.` +
            (names ? ` Yet to pay: ${names}.` : "")
        );
    }
    if (p.mode === "venue") return `Payment: to be collected at the venue (${rupees(p.amountPending)}).`;
    if (p.mode === "unpaid") return `Payment pending: ${rupees(p.amountPending)}.`;
    return `Payment: ${rupees(p.amountPaid)} paid online.`;
}

const TEMPLATES = {
    NEW_BOOKING: (turf, b) => ({
        title: `New booking · ${when(b)}`,
        message:
            `New booking at ${turf.name}\n` +
            `When: ${when(b)}\n` +
            `Player: ${b.contactName} (${b.contactPhone})\n` +
            `Group: ${b.players} players\n` +
            `Amount: ${rupees(b.totalAmount)}` +
            (b.discountAmount > 0 ? ` (after ${rupees(b.discountAmount)} coupon ${b.couponCode})` : "") +
            `\n${payLine(b)}\nRef: ${ref(b)}`
    }),
    BOOKING_CANCELLED: (turf, b) => ({
        title: `Booking cancelled · ${when(b)}`,
        message:
            `Booking cancelled at ${turf.name}\n` +
            `Was: ${when(b)}\n` +
            `Player: ${b.contactName} (${b.contactPhone})\n` +
            `The slot is free again.\nRef: ${ref(b)}`
    }),
    SPLIT_PAYMENT: (turf, b, extra) => ({
        title: `Split payment received · ${extra.memberName || "teammate"}`,
        message:
            `${extra.memberName || "A teammate"} paid ${rupees(extra.amount)} for the ${when(b)} booking at ${turf.name}.\n` +
            `${payLine(b)}\nRef: ${ref(b)}`
    }),
    PAYMENT_COMPLETE: (turf, b) => ({
        title: `Fully paid · ${when(b)}`,
        message:
            `All players have paid for the ${when(b)} booking at ${turf.name}.\n` +
            `Total ${rupees(b.totalAmount)} collected. Booking is confirmed.\n` +
            `Ref: ${ref(b)}`
    })
};

// Optional: forward every notification to an automation endpoint (Twilio,
// WhatsApp Cloud API, n8n, Zapier…) so owners get it without anyone clicking.
async function forwardToWebhook(doc) {
    const url = process.env.OWNER_NOTIFY_WEBHOOK_URL;
    if (!url || !doc.ownerPhone) return false;
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                to: doc.ownerPhone,
                ownerName: doc.ownerName,
                title: doc.title,
                message: doc.message,
                kind: doc.kind,
                notificationId: String(doc._id)
            })
        });
        return res.ok;
    } catch (err) {
        console.error("Owner webhook failed:", err.message);
        return false;
    }
}

// `turf` and `booking` are documents. Never throws: a notification problem
// must not fail a booking.
async function notifyOwner(kind, turf, booking, extra = {}) {
    try {
        if (!turf || !TEMPLATES[kind]) return null;
        const owner = await TurfOwner.findOne({ turf: turf._id });
        const { title, message } = TEMPLATES[kind](turf, booking, extra);

        const doc = await OwnerNotification.create({
            turf: turf._id,
            booking: booking._id,
            kind,
            title,
            message,
            ownerName: owner ? owner.name : "",
            ownerPhone: owner ? owner.phone : ""
        });

        if (await forwardToWebhook(doc)) {
            doc.webhookDelivered = true;
            doc.status = "Sent";
            doc.sentAt = new Date();
            await doc.save();
        }
        return doc;
    } catch (err) {
        console.error("Owner notification failed:", err.message);
        return null;
    }
}

module.exports = { notifyOwner };
