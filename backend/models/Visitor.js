const mongoose = require("mongoose");

// Quick-registration record captured on first visit to the public site.
// Deliberately separate from `User` (which requires a unique email and is
// only ever created from the booking flow) — a Visitor only ever supplies a
// name + phone number, no account, no password, no login.
const visitorSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        // Normalised to a plain 10-digit Indian mobile number (no country
        // code, no spaces/dashes) so the uniqueness check is consistent.
        phone: {
            type: String,
            required: true,
            trim: true,
            unique: true
        },

        // Set when the player signed in with Google (verified server-side).
        email: { type: String, default: "", trim: true, lowercase: true },
        googleId: { type: String, default: "", index: true },
        picture: { type: String, default: "" },

        lastVisitedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true // createdAt = first registration, updatedAt tracked too
    }
);

module.exports = mongoose.model("Visitor", visitorSchema);
