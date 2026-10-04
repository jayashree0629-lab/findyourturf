const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
    {
        eventName: {
            type: String,
            required: true,
            trim: true
        },

        sport: {
            type: String,
            required: true,
            // Any sport a turf offers can host an event (Cricket, Football,
            // Badminton, Box Cricket, ...), so this is free text, not an enum.
            maxlength: 40,
            trim: true
        },

        eventDate: {
            type: Date,
            required: true
        },

        teamSize: {
            type: String,
            required: true,
            trim: true
        },

        location: {
            type: String,
            required: true,
            trim: true
        },

        registrationDeadline: {
            type: Date,
            required: true
        },

        firstPrize: {
            type: Number,
            required: true,
            min: 0
        },

        secondPrize: {
            type: Number,
            required: true,
            min: 0
        },

        thirdPrize: {
            type: Number,
            required: true,
            min: 0
        },

        entryFee: {
            type: Number,
            default: 0,
            min: 0
        },

        maxTeams: {
            type: Number,
            default: 16,
            min: 2
        },

        description: {
            type: String,
            default: ""
        },

        rules: {
            type: String,
            default: ""
        },

        keyHighlights: {
            type: String,
            default: ""
        },

        venueName: {
            type: String,
            default: ""
        },

        contactPhone: {
            type: String,
            default: ""
        },

        eventImage: {
            type: String,
            default: ""
        },

        registrationLink: {
            type: String,
            default: ""
        },

        status: {
            type: String,
            // "Active" is kept for backward compatibility with older events —
            // it is treated the same as "Upcoming" (registration open).
            enum: ["Active", "Upcoming", "Ongoing", "Completed", "Cancelled"],
            default: "Upcoming"
        },

        registrationsCount: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Event", eventSchema);