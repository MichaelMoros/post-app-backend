const Users = require('../models/userModel')
const Posts = require('../models/postModel')
const Comments = require('../models/commentModel')
const Activities = require('../models/activitiesModel')
const Notifications = require('../models/notificationModel')
const conn = require('../models/index')
const bcrypt = require('bcrypt')
const asyncHandler = require("express-async-handler");
const createHashedPassword = require('../helpers/createHashedPassword')
const ResponseMessage = require('../helpers/responseMessage')
const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { ObjectId } = require('mongodb');
const nodemailer = require('nodemailer')
const { google } = require('googleapis')
const jwt = require('jsonwebtoken')
const { Socket, io } = require('../socket')

const CLIENT_ID = process.env.EMAIL_CLIENT_ID
const CLIENT_SECRET = process.env.EMAIL_CLIENT_SECRET
const REDIRECT_URI = process.env.EMAIL_REDIRECT_URI
const REFRESH_TOKEN = process.env.EMAIL_REFRESH_TOKEN
const CLIENT_EMAIL_ADDRESS = process.env.EMAIL_ADDRESS

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN })

const sendEmail = async (email, passwordResetlink) => {
    const accessToken = await oAuth2Client.getAccessToken()
    const transport = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            type: 'OAuth2',
            user: CLIENT_EMAIL_ADDRESS,
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET,
            refreshToken: REFRESH_TOKEN,
            accessToken: accessToken
        }
    })

    const mailOptions = {
        from: `[Test App] <${CLIENT_EMAIL_ADDRESS}>`,
        to: email,
        subject: "Password Reset Request",
        text: "Hello from Test App",
        html: `<div>
            <h5>Here's the link for password reset</h5>
            <p>You can click this link <a href=${passwordResetlink}>${passwordResetlink}</a> to complete your request </p>
        </div>`
    }

    try {
        const response = await transport.sendMail(mailOptions)
        return response
    } catch (e) {
        console.error(e.stack)
        return null
    }
}

// @desc     Create new user
// @route    POST /users
// @access   public
exports.createUser = asyncHandler(async (req, res) => {
    const { username, password, email } = req.body

    const userExist = await Users.findOne({ username: username.toLowerCase(), active: true })

    if (userExist) {
        res.status(400)
        throw new Error('User already exists.')
    }

    const userExistWithEmail = await Users.findOne({ email: email.toLowerCase() })

    if (userExistWithEmail) {
        res.status(400)
        throw new Error('Email already in use.')
    }

    const hashedPassword = await createHashedPassword(password)
    const session = await conn.startSession();

    try {
        session.startTransaction();
        const newUser = await Users.create([{
            username: username?.toLowerCase(),
            email: email?.toLowerCase(),
            password: hashedPassword,
            posts: [],
            likes: [],
            comments: []
        }], { session })

        const thisUser = newUser[0]

        const newActivity = await Activities.create([{
            activityType: "Join",
            active: true,
            owner: thisUser._id
        }], { session })

        const thisActivity = newActivity[0]

        thisUser.activities.push(thisActivity._id)
        await thisUser.save({ session })

        await session.commitTransaction();
        return res.status(201).json({ message: "success", _id: thisUser._id })
    } catch (err) {
        await session.abortTransaction()
        res.status(500)
        throw new Error(ResponseMessage.Error.serverError)
    }
})

// @desc     Login User
// @route    POST /users/login
// @access   Public
exports.loginUser = asyncHandler(async (req, res) => {
    const { username, password } = req.body
    const loginUsername = username?.toLowerCase()

    const user = await Users.findOne({ username: loginUsername, active: true })

    if (!user) {
        res.status(400)
        throw new Error(ResponseMessage.Error.notFound)
    }

    const session = await conn.startSession();

    try {
        session.startTransaction();
        const match = await bcrypt.compare(password, user.password)

        if (!match) {
            res.status(401)
            const activity = await Activities.create([{
                activityType: "Failed Login",
                active: true,
                owner: user._id
            }], { session })

            const thisActivity = activity[0]
            user.activities = [thisActivity._id, ...user.activities]
            await session.commitTransaction();

            return res.status(401).json({
                error: {
                    code: 401,
                    message: ResponseMessage.Error.unAuthorized
                }
            })
        }

        const newActivity = await Activities.create([{
            activityType: "Successful Login",
            active: true,
            owner: user._id
        }], { session })

        const thisActivity = newActivity[0]
        user.activities = [thisActivity._id, ...user.activities]

        const latestNotifications = await Notifications.find({ receiver: user._id }).sort({ createdAt: -1 }).select('-sender -receiver -createdAt -__v').limit(10)

        const accessToken = jwt.sign({ _id: user._id, username: user.username }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "5m" })
        const refreshToken = jwt.sign({ _id: user._id, username: user.username }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: "1d" })

        user.refreshToken = refreshToken
        await user.save({ session })
        await session.commitTransaction();

        res.cookie('jwt', refreshToken, { httpOnly: true, secure: false, maxAge: 24 * 60 * 60 * 1000 })

        return res.status(200).json({
            _id: user._id,
            username: user.username,
            accessToken,
            notifications: latestNotifications ?? []
        })

    } catch (err) {
        await session.abortTransaction();
        res.status(500)
        throw new Error(ResponseMessage.Error.serverError)
    }
})

// @desc     Validate user password
// @route    POST /users/:id/verify-password
// @access   Private
exports.verifyPassword = asyncHandler(async (req, res) => {
    const { password } = req.body
    const { password: CurrentUserPassword } = req.locals

    const match = await bcrypt.compare(password, CurrentUserPassword)

    if (!match) {
        res.status(401)
        throw new Error(ResponseMessage.Error.unAuthorized)
    }

    return res.status(200).json({ success: true })
})

// @desc     Update password
// @route    PUT /users/:id/password
// @access   Private
exports.updatePassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body

    const user = req.locals
    const match = await bcrypt.compare(oldPassword, user.password)

    if (!match) {
        res.status(401)
        throw new Error(ResponseMessage.Error.unAuthorized)
    }

    const isSameNewPassword = await bcrypt.compare(newPassword, user.password)

    if (isSameNewPassword) {
        res.status(400)
        throw new Error(ResponseMessage.Error.noChangesMade)
    }

    const session = await conn.startSession();

    try {
        session.startTransaction();

        const newActivity = await Activities.create([{
            activityType: "Update Password",
            active: true,
            owner: user._id
        }], { session })

        const thisActivity = newActivity[0]
        user.activities = [thisActivity._id, ...user.activities]
        const newHashedPassword = await createHashedPassword(newPassword)
        user.password = newHashedPassword
        await user.save({ session })

        await session.commitTransaction();
        return res.status(200).json({ message: "Password successfully updated." })
    } catch (err) {
        await session.abortTransaction()
        res.status(500)
        throw new Error(ResponseMessage.Error.serverError)
    }
})

// @desc     Update account visibility
// @route    PUT /users/:id/visibility
// @access   Private
exports.updateAccountVisibility = asyncHandler(async (req, res) => {
    const { visibility } = req.body
    const user = req.locals

    if (visibility === user.visibility) {
        res.status(400)
        throw new Error(ResponseMessage.Error.noChangesMade)
    }

    user.visibility = !user.visibility
    await user.save()
    return res.status(200).json({ message: "Account visibility updated!" })
})

// @desc     Get profile details
// @route    GET /users/:id/profile
// @access   Private
exports.getProfileDetails = asyncHandler(async (req, res) => {
    const id = req.user.id.toString()
    const excludedFields = { email: 0, comments: 0, updatedAt: 0, activities: 0, __v: 0, password: 0, posts: 0, refreshToken: 0 }

    const user = await Users.findOne({ _id: id }, excludedFields)
    if (!user) {
        res.status(404)
        throw new Error(ResponseMessage.Error.notFound)
    }

    return res.status(200).json({
        data: {
            user
        }
    })
})

// @desc     Get User profile details
// @desc     route can be probably split into separate endpoints but ending sticking to one
// @route    GET /users/:id/<params>
// @params   path<string<posts | likes>>
//           init?<string>
//           limit?<number>
//           index?<number> 
// @access   Public and Private
exports.getUserDetails = asyncHandler(async (req, res) => {
    const { id } = req.params
    const { path, index, limit, init } = req.query
    const excludedFields = { email: 0, comments: 0, updatedAt: 0, activities: 0, __v: 0, password: 0, refreshToken: 0 }

    const user = await Users.findOne({ username: id }, excludedFields)

    if (!user) {
        res.status(404)
        throw new Error(ResponseMessage.Error.notFound)
    }

    const currentUser = req.user;
    const belongsToUser = currentUser?._id?.toString() === user._id.toString()

    if (!user.visibility && !belongsToUser) {
        return res.status(200).json({
            data: {
                _id: user._id,
                username: user.username,
                visibility: user.visibility,
                createdAt: user.createdAt
            }
        })
    }

    const postExcludedFields = "-active -updatedAt -__v"
    const matchParams = belongsToUser ? { active: true } : { active: true, audience: "Public" }

    if (init) {
        await user.populate({
            path: "posts",
            match: matchParams,
            select: postExcludedFields,
            options: { limit: 10, sort: { createdAt: -1 } },
        })

        await user.populate({
            path: "posts.owner",
            match: matchParams,
            select: "_id username",
        })

        await user.populate({
            path: "likes",
            match: matchParams,
            select: postExcludedFields,
            options: { limit: 10, sort: { createdAt: -1 } },
        })

        await user.populate({
            path: "likes.owner",
            match: matchParams,
            select: "_id username"
        })

        return res.status(200).json({ data: user })
    }

    if (path === "posts" || path === "likes") {
        const start = Number(index)
        const end = Number(index) + Number(limit)

        if (isNaN(start) || isNaN(end)) {
            res.status(400)
            throw new Error(ResponseMessage.Error.badRequest)
        }

        await user.populate({
            path: path,
            match: matchParams,
            select: postExcludedFields,
            options: { skip: start, limit: end, sort: { createdAt: -1 } },
        })

        await user.populate({
            path: `${path}.owner`,
            match: matchParams,
            select: "_id username",
        })

        return res.status(200).json({ data: user[path] })
    }

    res.status(400)
    throw new Error(ResponseMessage.Error.badRequest)
})


// @desc     Generate Activity Log
// @route    GET /users/:id/export<params>
// @params   format<string<json,txt,csv>>
// @access   Private
exports.generateActivityLog = asyncHandler(async (req, res) => {
    const user = req.locals
    const { format } = req.query

    const SUPPORTED_FORMATS = ['json', 'txt', 'csv']

    if (!SUPPORTED_FORMATS.includes(format)) {
        res.status(400)
        throw new Error(ResponseMessage.Error.badRequest)
    }

    const thisUser = await Activities.find({ owner: user.id })
        .populate({ path: "owner", select: "username _id" })
        .populate({ path: "post" })
        .populate({ path: "comment" })
        .sort({ createdAt: -1 })


    if (format === 'json') {
        return res.status(200).json({ data: thisUser })
    }

    if (format === 'txt') {
        let text = ''

        thisUser.map((item) => {
            const { activityType, post, active, owner, createdAt, comment } = item
            text += `Type: ${activityType}` + '\n'
            text += `Timestamp: ${createdAt}` + '\n'

            if (post) {
                if (post.active) {
                    if (post.audience === 'Public') {
                        text += `Post: ${post.body}` + '\n'
                        text += `Path: /posts/${post._id}` + '\n'
                    }

                    else if (post.audience === 'Private') {
                        if (post.owner._id.toString() === user.id.toString()) {
                            text += `Post: ${post.body}` + '\n'
                            text += `Path: /posts/${post._id}` + '\n'
                        }

                        else {
                            text += `Post: [Protected Post]` + '\n'
                            text += `Path: /posts/${post._id}` + '\n'
                        }
                    }
                } else {
                    text += `Post: [Deleted Post]` + '\n'
                    text += `Path: /posts/${post._id}` + '\n'
                }
            }

            if (comment) {
                text += `Comment: ${comment.comment}` + '\n'
            }
            text += '\n' + '\n'
        })

        const time = String(Date.now())
        const fileName = `${user.id}-${time}.txt`

        res.attachment(fileName)
        res.type('txt')
        res.send(text)
    }

    if (format === 'csv') {
        const time = String(Date.now())
        const fileName = `${user.id}-${time}.csv`
        const csvWriter = createCsvWriter({
            path: `files/${fileName}`,
            header: [
                { id: 'time', title: 'DATETIME' },
                { id: 'activityType', title: 'ACTIVITY' },
                { id: 'post', title: 'POST' },
                { id: 'post_id', title: 'POST_ID' },
                { id: 'comment', title: 'COMMENT' },
            ]
        });

        const records = []

        thisUser.map((item) => {
            const { activityType, post, active, createdAt, comment } = item
            const row = {}

            row['activityType'] = activityType
            row['time'] = createdAt

            if (post) {
                if (post.active) {
                    if (post.audience === 'Public') {
                        row['post'] = post.body
                        row['post_id'] = post._id
                    }

                    else if (post.audience === 'Private') {
                        if (post.owner._id.toString() === user.id.toString()) {
                            row['post'] = post.body
                            row['post_id'] = post._id
                        }

                        else {
                            row['post'] = `[Protected Post]`
                            row['post_id'] = post._id
                        }
                    }
                } else {
                    row['post'] = `[Deleted Post]`
                }
            }

            if (comment) {
                row['comment'] = comment.comment
            }

            records.push(row)
        })

        csvWriter.writeRecords(records)
            .then(() => {
                const filePath = path.join(__dirname, '../files/')
                const filePathName = filePath + fileName

                // path of file, custom file name?, cb func
                res.download(filePathName, fileName, (err) => {
                    if (err) {
                        console.error(error.message)
                        res.status(500)
                        throw new Error(ResponseMessage.Error.serverError)
                    }

                    fs.unlink(filePathName, (err) => {
                        if (err) {
                            console.error(error.message)
                            res.status(500)
                            throw new Error(ResponseMessage.Error.serverError)
                        }
                    })
                })
            });
    }
})

// @desc     Deactivate account, disable account access and set all activity to not active
// @route    POST /users/:id/deactivate
// @access   Private
exports.deactivateAccount = asyncHandler(async (req, res) => {
    const user = req.locals

    await user.populate({ path: "likes", match: { active: true } })
    await user.populate({ path: "comments", match: { active: true } })
    await user.populate({ path: "posts", match: { active: true } })

    const session = await conn.startSession();

    try {
        session.startTransaction();

        for (let post of user.likes) {
            const updatedLikes = post.likes.map((post) => {
                if (post._id.toString() === user.id.toString()) {
                    post.active = false
                }
                return post
            })
            post.likes = updatedLikes
            await post.save({ session })
        }

        for (let post of user.posts) {
            post.active = false
            await post.save({ session })
        }

        for (let comment of user.comments) {
            comment.active = false
            await comment.save({ session })
        }

        user.active = false
        user.visibility = false
        await user.save({ session })
        await session.commitTransaction();

        return res.status(200).json({ message: "success" })
    } catch (err) {
        await session.abortTransaction()
        res.status(500)
        throw new Error(ResponseMessage.Error.serverError)
    }
})


// @desc     Delete account
// @route    POST /users/:id/delete-account
// @access   Private
exports.deleteAccount = asyncHandler(async (req, res) => {
    const user = req.locals

    const session = await conn.startSession();

    try {
        session.startTransaction();

        await Posts.deleteMany({ owner: user.id }, { session })

        // after deleting posts, some referrence are no longer available for the next task
        const userPostIds = [...user.posts].map((item) => item.toString())
        const userLikePostIds = [...user.likes].map((item) => item.toString())

        const likesPostIdsAfterDelete = []

        for (let likedPost of userLikePostIds) {
            if (!userPostIds.includes(likedPost)) {
                likesPostIdsAfterDelete.push(ObjectId(likedPost))
            }
        }

        user.likes = likesPostIdsAfterDelete

        // handle user likes, remove any referrence
        await user.populate({ path: "likes", match: { active: true } })
        for (let post of user.likes) {
            const updatedLikes = post.likes.filter((item) => item._id.toString() !== user.id.toString())
            post.likes = updatedLikes
            await post.save({ session })
        }

        // handle user comments, removes any referrence of user comment
        await user.populate({ path: "comments", populate: { path: "postId" } })

        const postCommentsWithDeletePost = [...user.comments].filter((item) => {
            if (!userPostIds.includes(item.postId._id.toString())) {
                return item
            }
        })

        user.comments = postCommentsWithDeletePost
        for (let comment of user.comments) {
            const thisPost = await Posts.findOne({ _id: comment.postId._id })
            const updatedComments = thisPost.comments.filter((item) => item.toString() !== comment._id.toString())
            thisPost.comments = updatedComments

            await Posts.findByIdAndUpdate(comment.postId._id, { comments: updatedComments }, { session })
        }

        await Comments.deleteMany({ owner: user.id }, { session })
        await Activities.deleteMany({ owner: user.id }, { session })
        await Users.deleteOne({ _id: user.id }, { session })

        await session.commitTransaction();
        return res.status(200).json({ message: 'success' })
    } catch (err) {
        await session.abortTransaction()
        res.status(500)
        throw new Error(ResponseMessage.Error.serverError)
    }
})


// @desc     Generate a password link
// @route    POST /users/forgot-password
// @access   Public
exports.generatePasswordLink = asyncHandler(async (req, res) => {
    const { email } = req.body
    const user = await Users.findOne({ email, active: true })

    if (!user) {
        res.status(404)
        throw new Error(ResponseMessage.Error.notFound)
    }

    const secret = process.env.PASSWORD_RESET_SECRET + user.password
    const payload = {
        email: user.email,
        id: user._id
    }

    const token = jwt.sign(payload, secret, { expiresIn: "15m" })
    const passwordLink = `${process.env.CLIENT_SIDE_ADDRESS}/reset-password/${user._id}/${token}`

    try {
        await sendEmail(user.email, passwordLink)
        return res.json({ message: `Password reset link sent to ${user.email}.` })
    } catch (err) {
        res.status(500)
        throw new Error(ResponseMessage.Error.serverError)
    }
})


// @desc     View route for password reset
// @route    Get /users/reset-password/:userId/:token
// @access   Public
exports.resetPassword = asyncHandler(async (req, res) => {
    const { userId, token } = req.params

    const user = await Users.findOne({ _id: userId, active: true })

    if (!user) {
        res.status(400)
        throw new Error(ResponseMessage.Error.notFound)
    }

    const secret = process.env.PASSWORD_RESET_SECRET + user.password

    try {
        const data = jwt.verify(token, secret)
        return res.status(200).json({ userId, token })
    } catch (e) {
        res.status(401)
        throw new Error(ResponseMessage.Error.unAuthorized)
    }
})


// @desc     Reset password from recovery
// @route    POST /users/reset-password/:userId/:token
// @access   Public
exports.resetPasswordFromRecovery = asyncHandler(async (req, res) => {
    const { userId, token } = req.params
    const { password } = req.body

    const user = await Users.findOne({ _id: userId, active: true })

    if (!user) {
        res.status(400)
        throw new Error(ResponseMessage.Error.notFound)
    }

    const secret = process.env.PASSWORD_RESET_SECRET + user.password

    try {
        const data = jwt.verify(token, secret)
        const hashedPassword = await createHashedPassword(password.toString())
        user.password = hashedPassword
        await user.save()

        return res.status(200).json({ message: "Password updated!" })
    } catch (e) {
        res.status(401)
        throw new Error(ResponseMessage.Error.unAuthorized)
    }
})


// @desc     Check email availability
// @route    GET /users/check-email-availability/${email}
// @access   Public
exports.checkEmailAvailability = asyncHandler(async (req, res) => {
    const { email } = req.params
    const user = await Users.findOne({ email })

    if (!user) {
        return res.status(200).json({ available: false })
    }

    return res.status(200).json({ available: true })
})


// @desc     Check username availability
// @route    GET /users/check-username-availability/${username}
// @access   Public
exports.checkUsernameAvailability = asyncHandler(async (req, res) => {
    const { username } = req.params
    const user = await Users.findOne({ username })

    if (!user) {
        return res.status(200).json({ available: false })
    }

    return res.status(200).json({ available: true })
})


// @desc     Logout User
// @route    GET /users/:id/logout
// @access   Private
exports.logout = asyncHandler(async (req, res) => {
    const user = req.user

    user.refreshToken = ""

    await user.save()
    res.clearCookie('jwt', { http: true, maxAge: 0 })
    return res.sendStatus(204)
})


// @desc     Resume User Session
// @route    GET /users/resume-session
// @access   Public
exports.resumeSession = asyncHandler(async (req, res) => {
    const cookies = req.cookies

    if (!cookies?.jwt) {
        res.status(401)
        throw new Error(ResponseMessage.Error.unAuthorized)
    }

    const refreshToken = cookies.jwt

    const foundUser = await Users.findOne({ refreshToken }).select('username')

    if (!foundUser) {
        res.status(403)
        throw new Error(ResponseMessage.Error.unAuthorizedWithAuth)
    }

    const latestNotifications = await Notifications.find({ receiver: foundUser._id }).sort({ createdAt: -1 }).select('-sender -receiver -createdAt -__v').limit(10)
    const accessToken = jwt.sign({ _id: foundUser._id, username: foundUser.username }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "5m" })

    const user = {
        username: foundUser.username,
        userId: foundUser._id,
        accessToken,
        notifications: latestNotifications ?? []
    }

    return res.status(200).json({ data: user })
})
