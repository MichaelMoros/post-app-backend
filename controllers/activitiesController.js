const Activities = require('../models/activitiesModel')
const asyncHandler = require("express-async-handler");
const ResponseMessage = require('../helpers/responseMessage');
const { getDateDiff } = require('../helpers/DateHelpers')

exports.getActivities = asyncHandler(async (req, res) => {
    const { day, start, end, week, month } = req.query
    const activityOwner = req.user._id.toString()

    // defaults to day=1, if no additional query 
    // handles last 24 hours
    if ((!day && !week && !month) || (day && !start && !end)) {
        const queryStart = new Date()
        const date = queryStart.getUTCDate()
        const hours = queryStart.getUTCHours()
        const minutes = queryStart.getUTCMinutes()
        const seconds = queryStart.getUTCSeconds()
        const milliseconds = queryStart.getUTCMilliseconds()

        const queryEnd = new Date(queryStart)
        queryEnd.setUTCDate(date - 1)
        queryEnd.setHours(hours, minutes, seconds, milliseconds)

        const items = await Activities.find(
            {
                createdAt:
                    { $lte: queryStart, $gte: queryEnd },
                owner: activityOwner,
                active: true
            })
            .populate({ path: "postOwner", match: { active: true }, select: "username" })
            .sort({ createdAt: -1 })

        return res.status(200).json({
            data: {
                count: items.length,
                items
            }
        })
    }

    // day with start no end, defaults to 00:00 - 23:59 
    // handles today, yesterday and specific date
    if (day && start && !end) {
        const queryStart = new Date(Number(start))
        queryStart.setUTCHours(0, 0, 0, 0)

        const queryEnd = new Date(Number(start))
        queryEnd.setUTCHours(23, 59, 59, 999)

        const items = await Activities.find({ createdAt: { $gte: queryStart, $lte: queryEnd }, owner: activityOwner, active: true }).sort({ createdAt: -1 })

        return res.status(200).json({
            data: {
                count: items.length,
                items
            }
        })
    }

    // get activities within 30 day max timeframe
    if (day && start && end) {
        const queryStart = new Date(Number(start))
        const queryEnd = new Date(Number(end))
        const requestTime = new Date()

        if (queryStart > requestTime) {
            res.status(400)
            throw new Error(ResponseMessage.Error.badRequest)
        }

        if (getDateDiff(queryStart, queryEnd) > 30) {
            res.status(400)
            throw new Error(ResponseMessage.Error.badRequest)
        }

        queryStart.setUTCHours(0, 0, 0, 0)
        queryEnd.setUTCHours(23, 59, 59, 999)

        const items = await Activities.find({ createdAt: { $gte: queryStart, $lte: queryEnd }, owner: activityOwner, active: true }).sort({ createdAt: -1 })

        return res.status(200).json({
            data: {
                count: items.length,
                items
            }
        })
    }

    // handle week requests
    // week<number>
    if (week) {
        const queryStart = new Date(Number(week))
        queryStart.setUTCHours(0, 0, 0, 0)
        const queryEnd = new Date(Number(week))
        queryEnd.setUTCDate(queryEnd.getUTCDate() + 7)
        queryEnd.setUTCHours(23, 59, 59, 999)

        const items = await Activities.find({ createdAt: { $gte: queryStart, $lte: queryEnd }, owner: activityOwner, active: true }).sort({ createdAt: -1 })

        return res.status(200).json({
            data: {
                count: items.length,
                items
            }
        })
    }

    // handle month requests
    // month<number>
    if (month) {
        const queryStart = new Date(Number(month))
        const plusOneMonth = queryStart.getUTCMonth() + 1
        const queryEnd = new Date(queryStart.getUTCFullYear(), plusOneMonth, 0)
        queryEnd.setUTCHours(23, 59, 59, 999)

        const items = await Activities.find({ createdAt: { $gte: queryStart, $lte: queryEnd }, owner: activityOwner, active: true }).sort({ createdAt: -1 })

        return res.status(200).json({
            data: {
                count: items.length,
                items
            }
        })
    }

    res.status(400)
    throw new Error(ResponseMessage.Error.badRequest)
})