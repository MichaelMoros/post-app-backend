const mongoose = require("mongoose");

const ActivitiesSchema = new mongoose.Schema(
    {
        activityType: {
            type: String,
            enum: ['New Post', 'New Comment', 'Like Post', 'Join', 'Failed Login', 'Successful Login', 'Update Password'],
            required: true
        },
        post: {
            type: mongoose.Schema.Types.ObjectId,
            required: false,
            ref: "Posts"
        },
        postOwner: {
            type: mongoose.Schema.Types.ObjectId,
            required: false,
            ref: "Users"
        },
        comment: {
            type: mongoose.Schema.Types.ObjectId,
            required: false,
            ref: "Comments"
        },
        active: {
            type: Boolean,
            required: true,
            default: true
        },
        postPreview: {
            type: String,
            required: false
        },
        commentPreview: {
            type: String,
            required: false
        },
        owner: { type: mongoose.Schema.Types.ObjectId, ref: "Users" }
    }, {
    timestamps: true,
});

module.exports = mongoose.model("Activities", ActivitiesSchema);
