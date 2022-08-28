const mongoose = require('mongoose')

const CommentsSchema = new mongoose.Schema({
    owner: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Users",
        required: true
    },
    postId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Posts",
        required: true
    },
    active: {
        type: Boolean,
        required: true,
        default: true
    },
    comment: {
        type: String,
        required: true,
        min: 1,
        maxlength: 1024
    },
    modified: {
        type: Boolean,
        default: false
    },
    updateHistory: [
        {
            comment: {
                type: String,
                required: true
            },
            createdAt: {
                type: Date,
                required: true
            }
        }
    ]
}, {
    timestamps: true
})

module.exports = mongoose.model('Comments', CommentsSchema)