const mongoose = require('mongoose')
const { G_Post } = require('../global')

const PostSchema = new mongoose.Schema({
    body: {
        type: String,
        trim: true,
        required: true,
        minlength: G_Post.BODY_MIN,
        maxlength: G_Post.BODY_MAX
    },
    active: {
        type: Boolean,
        required: true,
        default: true
    },
    audience: {
        type: String,
        trim: true,
        required: true,
        required: true,
        enum: {
            values: ['Public', 'Private'],
            message: 'Audience can be either, Public or Private.'
        }
    },
    status: {
        type: String,
        enum: {
            values: ['Posted'],
            message: 'Status can be either, Posted or Draft'
        },
        default: "Posted",
        required: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comments" }],
    likes: [{ type: { _id: mongoose.Schema.Types.ObjectId, username: String } }]
}, {
    timestamps: true,
    versionKey: false
})

module.exports = mongoose.model('Posts', PostSchema)