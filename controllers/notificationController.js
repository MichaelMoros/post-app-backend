const asyncHandler = require("express-async-handler");
const Notifications = require('../models/notificationModel')
const ResponseMessage = require('../helpers/responseMessage');

exports.getNotifications = asyncHandler(async (req, res) => {
    const user = req.locals
    const { skip, limit } = req.query

    const thisUserNotifications = await Notifications.find({ receiver: user._id }).sort({ createdAt: -1 }).select('-sender -receiver -createdAt -__v').skip(skip || 0).limit(limit || 10)
    return res.status(200).json({ data: thisUserNotifications })
}) 