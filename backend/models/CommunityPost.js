const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
    {
        authorName: { type: String, required: true, trim: true },
        authorId: { type: String, required: true },
        text: { type: String, required: true, trim: true },
        createdAt: { type: Date, default: Date.now }
    },
    { _id: true }
);

const communityPostSchema = new mongoose.Schema(
    {
        authorName: { type: String, required: true, trim: true },
        authorPhone: { type: String, default: "", trim: true },
        authorId: { type: String, required: true, index: true },
        // Posts written by an admin show an "Official" badge and can be pinned.
        isOfficial: { type: Boolean, default: false },

        text: { type: String, required: true, trim: true },
        sport: { type: String, default: "General", trim: true },

        likes: { type: [String], default: [] },
        comments: { type: [commentSchema], default: [] },

        pinned: { type: Boolean, default: false },
        hidden: { type: Boolean, default: false }
    },
    { timestamps: true }
);

communityPostSchema.index({ hidden: 1, pinned: -1, createdAt: -1 });

module.exports = mongoose.model("CommunityPost", communityPostSchema);
