const conn = require('../models/index')
const Users = require('../models/userModel')
const Comments = require('../models/commentModel')
const Posts = require('../models/postModel')
const Notifications = require('../models/notificationModel')
const Activities = require('../models/activitiesModel')
const asyncHandler = require("express-async-handler");
const ResponseMessage = require('../helpers/responseMessage')

// @desc     Update a single comment
// @route    PUT /comments/:commentId
// @access   Private
exports.updateComment = asyncHandler(async (req, res) => {
    const comment = req.locals
    const { comment: newComment } = req.body

    const session = await conn.startSession();

    if (comment.comment !== newComment) {
        try {
            session.startTransaction();
            comment.updateHistory.unshift({ comment: newComment, createdAt: Date.now() })

            if (!comment.modified) {
                comment.modified = true
            }

            comment.comment = newComment
            await comment.save({ session })
            await session.commitTransaction();
            return res.status(200).json({ message: 'success' })
        } catch (err) {
            await session.abortTransaction()
            res.status(500)
            throw new Error(ResponseMessage.Error.serverError)
        }
    } else {
        res.status(400)
        throw new Error(ResponseMessage.Error.noChangesMade)
    }
})

// @desc     Soft deletes a single comment
// @route    DELETE /comments/:commentId
// @access   Private
exports.deleteComment = async (req, res) => {
    const comment = req.locals
    const session = await conn.startSession();

    // no active prop, it could be that someone wants to clean up their activity log, even if the post no longer exist
    const thisPost = await Posts.findOne({ _id: comment.postId })

    if (!thisPost) {
        res.status(400)
        throw new Error(ResponseMessage.Error.badRequest)
    }

    const commentOwner = await Users.findOne({ _id: comment.owner, active: true })

    if (!commentOwner) {
        res.status(400)
        throw new Error(ResponseMessage.Error.badRequest)
    }

    const thisActivity = await Activities.findOne({ comment: comment._id, owner: comment.owner, active: true })

    if (!thisActivity) {
        res.status(400)
        throw new Error(ResponseMessage.Error.badRequest)
    }

    try {
        session.startTransaction();
        // cant make update with $pull to work

        const updatedPostComments = thisPost.comments.filter((item) => item._id.toString() !== comment._id.toString())
        thisPost.comments = updatedPostComments
        const updatedUserComments = commentOwner.comments.filter((item) => item._id.toString() !== comment._id.toString())
        commentOwner.comments = updatedUserComments

        thisActivity.active = false
        comment.active = false

        const thisPostCommentIds = thisPost.comments.map((item) => item.toString())

        if (!commentOwner.comments.some((commentId) => thisPostCommentIds.includes(commentId.toString()))) {
            // unsubscribe user to notifications since no more comments related on this post
            const thisNotification = await Notifications.findOne({ post: thisPost._id, notificationType: "Comment" })
            const updatedReceiverList = thisNotification.receiver.filter((item) => item.toString() !== commentOwner._id.toString())
            thisNotification.receiver = updatedReceiverList
            await thisNotification.save({ session })
        }

        if (updatedPostComments.length === 0) {
            await Notifications.deleteOne({ post: thisPost._id, notificationType: "Comment" }, { session })
        }

        await comment.save({ session })
        await thisPost.save({ session })
        await commentOwner.save({ session })
        await thisActivity.save({ session })
        await session.commitTransaction();
        return res.status(200).json({ message: "Comment successfully deleted." })
    } catch (err) {
        await session.abortTransaction()
        res.status(500)
        throw new Error(ResponseMessage.Error.serverError)
    }
}
