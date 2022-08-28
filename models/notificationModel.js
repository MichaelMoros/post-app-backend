const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
    {
        sender: {
            required: true,
            type: mongoose.Schema.Types.ObjectId, ref: "Users"
        },
        receiver: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
        notificationType: {
            type: String,
            required: true,
            enums: ['Comment', 'Like']
        },
        post: {
            required: true,
            type: mongoose.Schema.Types.ObjectId, ref: "Posts"
        },
        isRead: {
            required: true,
            type: Boolean,
            default: false
        },
        message: {
            type: String,
            required: true
        }
    }, {
    timestamps: true,
});

module.exports = mongoose.model("Notifications", NotificationSchema);
