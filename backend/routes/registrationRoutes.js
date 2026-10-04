const express = require("express");
const Registration = require("../models/Registration");
const Event = require("../models/Event");

const router = express.Router();

// Statuses that close registration. Anything else (including the legacy
// "Active" value and the default "Upcoming") keeps registration open.
const REGISTRATION_CLOSED_STATUSES = ["Ongoing", "Completed", "Cancelled"];

function isRegistrationOpen(status) {
    return !REGISTRATION_CLOSED_STATUSES.includes(status);
}


// ==========================================
// CREATE REGISTRATION
// POST /api/registrations
// ==========================================
router.post("/", async (req, res) => {
    try {
        const { event } = req.body;

        // Check whether event exists
        const existingEvent = await Event.findById(event);

        if (!existingEvent) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }

        if (!isRegistrationOpen(existingEvent.status)) {
            return res.status(403).json({
                success: false,
                message: "Registration is closed for this tournament."
            });
        }

        const registration = await Registration.create(req.body);

        // Increase registration count
        await Event.findByIdAndUpdate(
            event,
            {
                $inc: { registrationsCount: 1 }
            }
        );

        res.status(201).json({
            success: true,
            message: "Registration created successfully",
            registration
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: "Failed to create registration",
            error: error.message
        });
    }
});


// ==========================================
// GET ALL REGISTRATIONS
// GET /api/registrations
// ==========================================
router.get("/", async (req, res) => {
    try {
        const registrations = await Registration.find()
            .populate("event", "eventName sport eventDate")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: registrations.length,
            registrations
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch registrations",
            error: error.message
        });
    }
});


// ==========================================
// GET REGISTRATIONS FOR ONE EVENT
// GET /api/registrations/event/:eventId
// ==========================================
router.get("/event/:eventId", async (req, res) => {
    try {
        const registrations = await Registration.find({
            event: req.params.eventId
        })
            .populate("event", "eventName sport eventDate")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: registrations.length,
            registrations
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch event registrations",
            error: error.message
        });
    }
});


// ==========================================
// GET SINGLE REGISTRATION
// GET /api/registrations/:id
// ==========================================
router.get("/:id", async (req, res) => {
    try {
        const registration = await Registration.findById(req.params.id)
            .populate("event", "eventName sport eventDate");

        if (!registration) {
            return res.status(404).json({
                success: false,
                message: "Registration not found"
            });
        }

        res.status(200).json({
            success: true,
            registration
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch registration",
            error: error.message
        });
    }
});


// ==========================================
// UPDATE REGISTRATION STATUS
// PUT /api/registrations/:id
// ==========================================
router.put("/:id", async (req, res) => {
    try {
        const registration = await Registration.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true
            }
        );

        if (!registration) {
            return res.status(404).json({
                success: false,
                message: "Registration not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Registration updated successfully",
            registration
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: "Failed to update registration",
            error: error.message
        });
    }
});


// ==========================================
// DELETE REGISTRATION
// DELETE /api/registrations/:id
// ==========================================
router.delete("/:id", async (req, res) => {
    try {
        const registration = await Registration.findById(
            req.params.id
        );

        if (!registration) {
            return res.status(404).json({
                success: false,
                message: "Registration not found"
            });
        }

        await Registration.findByIdAndDelete(req.params.id);

        // Decrease event registration count
        await Event.findByIdAndUpdate(
            registration.event,
            {
                $inc: { registrationsCount: -1 }
            }
        );

        res.status(200).json({
            success: true,
            message: "Registration deleted successfully"
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to delete registration",
            error: error.message
        });
    }
});


module.exports = router;