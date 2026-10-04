const mongoose = require("mongoose");

// One message for a turf owner about a booking event. There is no SMS /
// WhatsApp gateway wired in, so these form an outbox: admin sends each one
// with a WhatsApp click-to-chat link (or an optional webhook forwards it).
const ownerNotificationSchema = new mongoose.Schema(
    {
        turf: { type: mongoose.Schema.Types.ObjectId, ref: "Turf", required: true, index: true },
        booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null, index: true },
        kind: {
            type: String,
            enum: ["NEW_BOOKING", "BOOKING_CANCELLED", "SPLIT_PAYMENT", "PAYMENT_COMPLETE"],
            required: true
        },
        title: { type: String, required: true, trim: true },
        message: { type: String, required: true, trim: true },

        // Snapshot of the owner at the time; empty when no owner is set yet.
        ownerName: { type: String, default: "", trim: true },
        ownerPhone: { type: String, default: "", trim: true },

        status: { type: String, enum: ["Pending", "Sent"], default: "Pending", index: true },
        sentAt: { type: Date, default: null },
        // Whether the optional webhook accepted it.
        webhookDelivered: { type: Boolean, default: false }
    },
    { timestamps: true }
);

module.exports = mongoose.model("OwnerNotification", ownerNotificationSchema);
