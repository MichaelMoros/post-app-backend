const Posts = require('../models/postModel')
const Users = require('../models/userModel')
const Comments = require('../models/commentModel')
const Activities = require('../models/activitiesModel')
const asyncHandler = require("express-async-handler");
const conn = require('../models/index')
const ResponseMessage = require('../helpers/responseMessage')
const Notifications = require('../models/notificationModel')
const { Socket, io } = require('../socket')

// @desc     Get all comments from post
// @route    GET /posts/:postid/comments
// @access   Public / Private
// @return   Comments[]
exports.getComments = asyncHandler(async (req, res) => {
    const { postId } = req.params

    const excludedFields = { createdAt: 0, updatedAt: 0, __v: 0 }
    const post = await Posts.findOne({ _id: postId, active: 1 }, excludedFields)

    if (!post) {
        res.status(404)
        throw new Error(ResponseMessage.Error.notFound)
    }

    const commentsExcludedFields = { active: 0, updatedAt: 0, __v: 0 }
    const comments = await Comments
        .find({ _id: { $in: post.comments }, active: 1 }, commentsExcludedFields)
        .populate('owner', '_id username')
        .sort({ createdAt: 'desc' })

    if ((post.audience === 'Private')) {
        if (!req.user) {
            res.status(401)
            throw new Error(ResponseMessage.Error.unAuthorized)
        }

        if (req.user && req.user?._id?.toString() !== post.owner._id.toString()) {
            res.status(403)
            throw new Error(ResponseMessage.Error.unAuthorizedWithAuth)
        }

        return res.status(200).json({
            data: {
                count: comments.length,
                comments
            }
        })
    }

    return res.status(200).json({
        data: {
            count: comments.length,
            comments
        }
    })
})

// @desc     Get a single post with populated comments
// @route    GET /posts/:postid
// @access   Public and Private
// @return   Post
exports.getOnePostFull = asyncHandler(async (req, res) => {
    const { postId } = req.params

    const post = await Posts.findOne({ _id: postId, active: 1 }).select('-updatedAt -__v')
        .populate({ path: "owner", match: { active: true }, select: "_id username" })
        .populate(
            {
                path: "comments",
                populate: (
                    {
                        path: "owner",
                        options: {
                            match: { active: true }, select: "username _id"
                        }
                    }),
                options: {
                    sort: {
                        createdAt: -1
                    }
                }
            })
        .exec()

    if (!post) {
        res.status(404)
        throw new Error(ResponseMessage.Error.notFound)
    }

    const { _id, body, audience, owner, comments, likes, createdAt } = post

    if (audience === 'Private') {
        if (!req.user) {
            res.status(401)
            throw new Error(ResponseMessage.Error.unAuthorized)
        }

        if (owner._id.toString() !== req.user?._id?.toString()) {
            res.status(403)
            throw new Error(ResponseMessage.Error.unAuthorizedWithAuth)
        }
    }

    return res.status(200).json({
        data: {
            _id,
            body,
            audience,
            owner,
            comments,
            likes,
            createdAt
        }
    })
})

// @desc     Get n posts base on params
// @route    GET /posts/v1/?params
// @params   limit<number>, lastItem<number>
// @access   Private
// @return   Post[]
exports.getPostWithParams = asyncHandler(async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) > 10 ? 10 : req.query.limit : 10
    const lastItem = req.query.lastItem

    const excludedFields = { __v: 0, active: 0, updatedAt: 0 }

    if (lastItem) {
        const posts = await Posts.find({
            active: true,
            createdAt: {
                $lt: new Date(parseInt(lastItem))
            },
            audience: "Public"
        }, excludedFields)
            .populate(
                { path: "owner", match: { active: true }, select: "_id username" }
            )
            .sort({ createdAt: -1 }).limit(limit)

        return res.status(200).json({
            count: posts.length,
            posts
        })
    }

    const posts = await Posts.find({ active: true, audience: "Public" }, excludedFields)
        .populate(
            { path: "owner", match: { active: true }, select: "_id username" }
        )
        .sort({ createdAt: -1 }).limit(limit)

    return res.status(200).json({
        data: {
            count: posts.length,
            posts
        }
    })
})

// @desc     Add/Remove like from a single post
// @route    /posts/:postid/like
// @access   Private
// @return   SuccessMessage
exports.toggleLike = asyncHandler(async (req, res) => {
    const { _id, username } = req.user
    const { isLiked } = req.body

    const post = await Posts.findOne({ _id: req.params.postId })

    if (!post) {
        res.status(404)
        throw new Error(ResponseMessage.Error.notFound)
    }

    const postBelongsToUser = post.owner.toString() === req.user._id.toString()

    if (post.audience === 'Private' && !postBelongsToUser) {
        res.status(401)
        throw new Error(ResponseMessage.Error.unAuthorized)
    }

    const currentLikeStatus = post.likes.some((user) => user.username === username)

    if (currentLikeStatus === isLiked) {
        res.status(400)
        throw new Error(ResponseMessage.Error.noChangesMade)
    }

    const session = await conn.startSession();

    try {
        session.startTransaction();
        const user = await Users.findOne({ _id: req.user.id })

        if (currentLikeStatus) {
            post.likes = post.likes.filter((user) => user.username !== username)

            const deletedPost = await Activities.deleteOne({ activityType: "Like Post", owner: user._id, post: post._id }, { session })
            if (deletedPost.deletedCount === 0) throw new Error('Unable to apply delete activities collection')

            const updatedLikesList = user.likes.filter((item) => item.toString() !== post._id.toString())

            user.likes = updatedLikesList
            const thisNotification = await Notifications.findOne({ post: post._id, notificationType: "Like" })

            if (post.likes.length === 0) {
                await Notifications.deleteOne({ post: post._id, notificationType: "Like" }, { session })
            } else {
                const mostRecentLiker = post.likes[0].username
                const newNotificationMessage = post.likes.length === 1 ? `${mostRecentLiker === user.username ? 'You' : mostRecentLiker} liked your post` : `${mostRecentLiker} and ${post.likes.length - 1} liked your post`
                thisNotification.message = newNotificationMessage
                await thisNotification.save({ session })
            }

            await post.save({ session })
            await user.save({ session })
            await session.commitTransaction();
            return res.status(200).json({ message: "Success" })
        }

        if (!currentLikeStatus) {
            const newActivity = await Activities.create([{
                activityType: "Like Post",
                active: true,
                post: post._id,
                postOwner: post.owner,
                owner: user._id
            }], { session })


            const thisActivity = newActivity[0]
            post.likes = [...post.likes, { username, _id }]
            user.activities = [thisActivity._id, ...user.activities]
            user.likes.push(post._id)

            let thisNotification = await Notifications.findOne({ post: post._id, notificationType: "Like" })

            const postLiker = user._id.toString() === post.owner.toString() ? 'You' : user.username
            const notificationMessage = post.likes.length - 1 < 1
                ? `${postLiker === 'You' ? 'You liked your own post' : `${postLiker} liked your post`}`
                : `${postLiker} and ${post.likes.length - 1} others liked your post`

            if (!thisNotification) {
                thisNotification = await Notifications.create([{
                    sender: user._id,
                    receiver: [post.owner],
                    notificationType: "Like",
                    post: post._id,
                    message: notificationMessage
                }], { session })
            }

            else {
                thisNotification.sender = user._id
                thisNotification.message = notificationMessage
                await thisNotification.save({ session })
            }

            await post.save({ session })
            await user.save({ session })
            await session.commitTransaction();

            const notificationPostProcessing = Array.isArray(thisNotification) ? thisNotification[0] : thisNotification

            let emitPayload = {
                _id: notificationPostProcessing._id,
                notificationType: notificationPostProcessing.notificationType,
                post: notificationPostProcessing.post,
                isRead: notificationPostProcessing.isRead,
                message: notificationPostProcessing.message,
                updatedAt: notificationPostProcessing.updatedAt
            }

            const notificationRecipient = Socket.activeClients[post.owner.toString()]
            io.to(notificationRecipient).emit('notify', emitPayload)
            return res.status(201).json({ message: "Success" })
        }
    } catch (err) {
        await session.abortTransaction()
        res.status(500)
        throw new Error(ResponseMessage.Error.serverError)
    }
})

// @desc     Create a single post
// @route    POST /posts
// @access   Private
exports.addNewPost = async (req, res) => {
    const { body, audience, status } = req.body

    const session = await conn.startSession();

    const postPreviewText = body.length > 128 ? body.slice(0, 125) + '...' : body

    try {
        session.startTransaction();

        // needs to be array to attach session
        const newPost = await Posts.create([{
            body,
            audience,
            owner: req.user?._id
        }], { session })

        const thisPost = newPost[0]

        const newActivity = await Activities.create([{
            activityType: "New Post",
            active: true,
            owner: req.user.id,
            postOwner: req.user.id,
            post: thisPost._id,
            postPreview: postPreviewText
        }], { session })

        const thisActivity = newActivity[0]

        const user = await Users.findOne({ _id: req.user.id })
        user.posts.unshift(thisPost._id)
        user.activities.unshift(thisActivity._id)
        await user.save({ session })

        await session.commitTransaction();

        const { likes, createdAt, updatedAt, status, comments, owner, _id } = newPost[0]
        return res.status(200).json({
            data: { _id, body, audience, status, owner, comments, likes, createdAt, updatedAt }
        })
    } catch (err) {
        await session.abortTransaction()
        res.status(500)
        throw new Error(ResponseMessage.Error.serverError)
    }
}

// @desc     Add a comment on a post
// @route    /posts/:postid/comment
// @access   Private
exports.addComment = asyncHandler(async (req, res) => {
    const { comment } = req.body
    const user = req.user

    const PostExcludedFields = "-updatedAt -__v"
    const post = await Posts.findOne({ _id: req.params.postId }).select(PostExcludedFields)

    if (!post) {
        res.status(404)
        throw new Error(ResponseMessage.Error.notFound)
    }

    const postBelongsToUser = post.owner.toString() === user._id.toString()

    if (post.audience === 'Private' && !postBelongsToUser) {
        res.status(401)
        throw new Error(ResponseMessage.Error.unAuthorized)
    }

    const commentPreview = comment.length > 128 ? comment.slice(0, 125) + '...' : comment
    const session = await conn.startSession();

    try {
        session.startTransaction();

        const newComment = await Comments.create([{
            owner: user._id,
            comment,
            postId: post._id
        }], { session })

        const thisComment = newComment[0]

        const newActivity = await Activities.create([{
            activityType: "New Comment",
            active: true,
            owner: user._id,
            postOwner: post.owner,
            post: post._id,
            comment: thisComment._id,
            commentPreview
        }], { session })

        const thisActivity = newActivity[0]

        await Posts.updateOne({ _id: post._id }, { $push: { comments: thisComment._id, updateHistory: thisComment._id } }, { session })
        await Comments.updateOne({ _id: thisComment._id }, {
            $push: {
                updateHistory: {
                    comment: thisComment.comment,
                    createdAt: thisComment.createdAt,
                    _id: thisComment._id
                }
            }
        }, { session })

        user.comments.push(thisComment._id)
        user.activities.push(thisActivity._id)

        let thisNotification = await Notifications.findOne({ post: post._id, notificationType: "Comment" })

        const commentor = user._id.toString() === post.owner.toString() ? 'You' : user.username
        const notificationMessage = `${commentor} commented "${comment.length > 50 ? `${comment.slice(0, 47)}...` : comment}" on subscribed post.`

        if (!thisNotification) {
            const receiverPostOwnerAndCommentor = [post.owner, user._id]
            thisNotification = await Notifications.create([{
                sender: user._id,
                receiver: receiverPostOwnerAndCommentor,
                notificationType: "Comment",
                post: post._id,
                message: notificationMessage
            }], { session })
        }

        else {
            const currentReceivers = [...thisNotification.receiver]
            thisNotification.sender = user._id
            thisNotification.receiver = thisNotification.receiver.some((item) => item.toString() === user._id.toString())
                ? currentReceivers
                : [...thisNotification.receiver, user._id]

            thisNotification.message = notificationMessage
            await thisNotification.save({ session })
        }

        await user.save({ session })
        await session.commitTransaction();

        const notificationPostProcessing = Array.isArray(thisNotification) ? thisNotification[0] : thisNotification
        let notificationRecipientsExceptCommentor = notificationPostProcessing.receiver.filter((item) => item.toString() !== user._id.toString())

        let emitPayload = {
            _id: notificationPostProcessing._id,
            notificationType: notificationPostProcessing.notificationType,
            post: notificationPostProcessing.post,
            isRead: notificationPostProcessing.isRead,
            message: notificationPostProcessing.message,
            updatedAt: notificationPostProcessing.updatedAt
        }

        notificationRecipientsExceptCommentor.forEach((receipient) => {
            io.to(Socket.activeClients[receipient.toString()]).emit('notify', emitPayload)
        })

        return res.status(200).json({ data: thisComment })

    } catch (err) {
        await session.abortTransaction();
        res.status(500)
        throw new Error(ResponseMessage.Error.serverError)
    }
})

// @desc     Update property/properties from a single own post
// @route    /posts/:postid
// @access   Private
exports.updatePost = asyncHandler(async (req, res) => {
    const post = req.locals
    const { audience } = req.body

    const VALID_AUDIENCE_STATES = ['Public', 'Private']

    if (!VALID_AUDIENCE_STATES.includes(audience)) {
        res.status(400)
        throw new Error(ResponseMessage.Error.badRequest)
    }

    if (audience === post.audience) {
        res.status(400)
        throw new Error(ResponseMessage.Error.noChangesMade)
    }

    post.audience = audience
    await post.save()
    return res.status(200).json({ message: "Post successfully posted." })
})

// @desc     Delete a single post
//           users that commented on this post, will still have the referrence of their own comment
//           but in terms of actual posts and other users comment will not visible
// @route    /posts/:postid
// @access   Private
exports.deletePost = async (req, res) => {
    const post = req.locals
    const session = await conn.startSession();

    const currentUser = await Users.findOne({ _id: post.owner, active: true })

    if (!currentUser) {
        res.status(400)
        throw new Error(ResponseMessage.Error.badRequest)
    }

    const thisActivity = await Activities.findOne({ post: post._id, owner: currentUser._id, active: true })

    if (!thisActivity) {
        res.status(400)
        throw new Error(ResponseMessage.Error.badRequest)
    }

    try {
        session.startTransaction();
        const updatedUserPosts = currentUser.posts.filter((item) => item._id.toString() !== post._id.toString())
        await Notifications.deleteMany({ post: post._id })
        currentUser.posts = updatedUserPosts
        thisActivity.active = false
        post.active = false

        await post.save({ session })
        await currentUser.save({ session })
        await thisActivity.save({ session })
        await session.commitTransaction();
        return res.status(200).json({ message: "Post successfully deleted." })
    } catch (err) {
        await session.abortTransaction()
        res.status(500)
        throw new Error(ResponseMessage.Error.serverError)
    }
}