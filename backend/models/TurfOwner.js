const mongoose = require("mongoose");
const crypto = require("crypto");

// Who runs a turf. Kept separate from Turf so owner contact details and the
// private portal token are never returned by the public turf endpoints.
const turfOwnerSchema = new mongoose.Schema(
    {
        turf: { type: mongoose.Schema.Types.ObjectId, ref: "Turf", required: true, unique: true },
        name: { type: String, required: true, trim: true },
        phone: { type: String, required: true, trim: true },
        email: { type: String, default: "", trim: true, lowercase: true },
        // Secret link segment for the owner's read-only booking portal.
        accessToken: {
            type: String,
            required: true,
            unique: true,
            default: () => crypto.randomBytes(18).toString("hex")
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("TurfOwner", turfOwnerSchema);
