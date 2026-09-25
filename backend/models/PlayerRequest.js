const mongoose = require("mongoose");

const joinerSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        phone: { type: String, required: true, trim: true },
        playerId: { type: String, required: true },
        joinedAt: { type: Date, default: Date.now }
    },
    { _id: false }
);

// "Find Players" — a host posts a game that still needs players; others join.
const playerRequestSchema = new mongoose.Schema(
    {
        sport: { type: String, required: true, trim: true },
        turfName: { type: String, default: "", trim: true },
        area: { type: String, default: "", trim: true },
        // Stored as UTC midnight of the chosen calendar day (same as Booking).
        date: { type: Date, required: true },
        time: { type: String, required: true, trim: true },
        playersNeeded: { type: Number, required: true, min: 1, max: 30 },
        skillLevel: {
            type: String,
            enum: ["Any", "Beginner", "Intermediate", "Advanced"],
            default: "Any"
        },
        costPerPlayer: { type: Number, default: 0, min: 0 },
        notes: { type: String, default: "", trim: true },

        hostName: { type: String, required: true, trim: true },
        hostPhone: { type: String, required: true, trim: true },
        hostId: { type: String, required: true, index: true },

        joiners: { type: [joinerSchema], default: [] },

        status: {
            type: String,
            enum: ["Open", "Full", "Closed", "Removed"],
            default: "Open"
        }
    },
    { timestamps: true }
);

playerRequestSchema.index({ status: 1, date: 1 });

module.exports = mongoose.model("PlayerRequest", playerRequestSchema);
