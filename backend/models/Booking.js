const mongoose = require("mongoose");

const lineItemSchema = new mongoose.Schema(
    {
        label: { type: String, required: true },
        amount: { type: Number, required: true, min: 0 }
    },
    { _id: false }
);

const splitMemberSchema = new mongoose.Schema(
    {
        name: { type: String, default: "", trim: true },
        phone: { type: String, required: true, trim: true },
        gpayNumber: { type: String, default: "", trim: true },
        sendMethod: { type: String, enum: ["sms", "gpay"], default: "sms" },
        paid: { type: Boolean, default: false },
        paidAt: { type: Date, default: null }
    },
    { _id: false }
);

const bookingSchema = new mongoose.Schema(
    {
        // Linked only when an existing User already matches the contact email /
        // phone. The player app has no login, so bookings primarily carry the
        // contact snapshot below.
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: false,
            default: null
        },

        turf: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Turf",
            required: true
        },

        bookingDate: {
            type: Date,
            required: true
        },

        startTime: {
            type: String,
            required: true
        },

        endTime: {
            type: String,
            required: true
        },

        // --- Split payment -------------------------------------------------
        players: {
            type: Number,
            default: 1,
            min: 1
        },

        // ceil(totalAmount / players)
        perPersonAmount: {
            type: Number,
            default: 0,
            min: 0
        },

        // --- Price breakdown (all computed server-side) --------------------
        baseAmount: { type: Number, default: 0, min: 0 },
        floodlightApplied: { type: Boolean, default: false },
        floodlightAmount: { type: Number, default: 0, min: 0 },
        equipmentSelected: {
            type: [lineItemSchema],
            default: []
        },
        equipmentAmount: { type: Number, default: 0, min: 0 },

        // Sum of all attached add-ons (photography / videography / coach /
        // equipment rental). Line detail lives in the AddonBooking collection.
        addonsAmount: { type: Number, default: 0, min: 0 },

        // Coupon applied at checkout. totalAmount is already net of this.
        couponCode: { type: String, default: "", trim: true },
        discountAmount: { type: Number, default: 0, min: 0 },

        totalAmount: {
            type: Number,
            required: true
        },

        // --- Contact snapshot (there is no user login on the player app) ---
        contactName: { type: String, default: "", trim: true },
        contactPhone: { type: String, default: "", trim: true },
        contactEmail: { type: String, default: "", trim: true },

        paymentMethod: { type: String, default: "UPI", trim: true },
        paymentPlan: { type: String, enum: ["full", "split"], default: "full" },
        splitMembers: { type: [splitMemberSchema], default: [] },
        splitPaymentStatus: {
            type: String,
            enum: ["NotApplicable", "Pending", "Completed"],
            default: "NotApplicable"
        },

        status: {
            type: String,
            enum: ["Pending", "Confirmed", "Cancelled"],
            required: true
        }
    },
    {
        timestamps: true
    }
);

// Fast lookup + guard for slot clashes on a given turf/day.
bookingSchema.index({ turf: 1, bookingDate: 1, startTime: 1 });

module.exports = mongoose.model("Booking", bookingSchema);
