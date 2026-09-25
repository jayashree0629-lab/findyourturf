const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
    {
        code: { type: String, required: true, unique: true, uppercase: true, trim: true },
        label: { type: String, default: "", trim: true },

        type: { type: String, enum: ["FLAT", "PERCENT"], required: true },
        // FLAT: rupees off.  PERCENT: 1-100.
        value: { type: Number, required: true, min: 1 },
        // Cap for PERCENT coupons (0 = no cap).
        maxDiscount: { type: Number, default: 0, min: 0 },
        // Minimum booking total the coupon applies to.
        minOrder: { type: Number, default: 0, min: 0 },

        // Where it came from — drives the badge in the player's wallet.
        source: { type: String, enum: ["REWARD", "ZONE", "ADMIN"], default: "ADMIN" },
        // When set, only this phone number can use it.
        phone: { type: String, default: "", trim: true, index: true },
        // Points spent to obtain it (REWARD coupons only).
        pointsCost: { type: Number, default: 0, min: 0 },

        // 0 = unlimited. Each phone can only ever use a given code once.
        maxUses: { type: Number, default: 1, min: 0 },
        usedCount: { type: Number, default: 0, min: 0 },
        usedBy: { type: [String], default: [] },

        active: { type: Boolean, default: true },
        expiresAt: { type: Date, default: null }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Coupon", couponSchema);
