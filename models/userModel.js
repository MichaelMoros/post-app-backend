const mongoose = require("mongoose");
const { G_User } = require('../global')

const UserSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            minlength: G_User.USERNAME_MIN,
            maxlength: G_User.USERNAME_MAX,
            unique: true,
            required: true
        },
        password: {
            type: String,
            minlength: G_User.PASSWORD_MIN,
            maxlength: G_User.PASSWORD_MAX,
            required: true
        },
        email: {
            type: String,
            minlength: G_User.EMAIL_MIN,
            maxlength: G_User.EMAIL_MAX,
            unique: true,
            required: true
        },
        visibility: {
            type: Boolean,
            default: true,
            required: true
        },
        active: {
            type: Boolean,
            default: true,
            required: true
        },
        refreshToken: {
            type: String,
            default: "",
            required: false,
            select: false
        },
        likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Posts" }],
        posts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Posts" }],
        comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comments" }],
        activities: [{ type: mongoose.Schema.Types.ObjectId, ref: "Activities" }]
    }, {
    timestamps: true
});

module.exports = mongoose.model("Users", UserSchema);
