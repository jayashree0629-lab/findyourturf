const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
    {
        // "general", "cricket", "football", ... or "req-<PlayerRequest _id>".
        room: { type: String, required: true, index: true, trim: true },
        senderName: { type: String, required: true, trim: true },
        senderPhone: { type: String, required: true, trim: true },
        senderId: { type: String, required: true },
        text: { type: String, required: true, trim: true },
        deleted: { type: Boolean, default: false }
    },
    { timestamps: true }
);

chatMessageSchema.index({ room: 1, createdAt: -1 });

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
