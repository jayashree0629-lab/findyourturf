const mongoose = require("mongoose");

// Student Zone / Corporate Zone requests. Admin reviews, and on approval can
// issue a personal discount coupon that the player redeems at checkout.
const zoneEnquirySchema = new mongoose.Schema(
    {
        zone: { type: String, enum: ["student", "corporate"], required: true },

        name: { type: String, required: true, trim: true },
        phone: { type: String, required: true, trim: true, index: true },
        email: { type: String, default: "", trim: true, lowercase: true },

        // College / company name.
        organization: { type: String, required: true, trim: true },
        // Student: course / year.  Corporate: the contact's role.
        detail: { type: String, default: "", trim: true },
        // Corporate: approximate headcount. Student: usually the team size.
        groupSize: { type: Number, default: 1, min: 1, max: 5000 },
        sport: { type: String, default: "", trim: true },
        preferredDate: { type: Date, default: null },
        message: { type: String, default: "", trim: true },

        status: {
            type: String,
            enum: ["New", "In Review", "Approved", "Rejected", "Closed"],
            default: "New"
        },
        adminNote: { type: String, default: "", trim: true },
        couponCode: { type: String, default: "", trim: true }
    },
    { timestamps: true }
);

zoneEnquirySchema.index({ zone: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("ZoneEnquiry", zoneEnquirySchema);
