const jwt = require("jsonwebtoken")
const Users = require('../models/userModel')
const asyncHandler = require('express-async-handler')
const ResponseMessage = require('../helpers/responseMessage')

module.exports = asyncHandler(async (req, res, next) => {
    let token

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        try {
            // get token from header
            token = req.headers.authorization.split(" ")[1]

            // verify token
            const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

            // get user data
            const user = await Users.findOne({ _id: decoded._id, active: true }).select('-password -email')
            if (!user) {
                res.status(404)
                throw new Error(ResponseMessage.Error.notFound)
            }

            req.user = user
            next()
        } catch (error) {
            if (error.message === "jwt expired") {
                res.status(403)
                throw new Error(ResponseMessage.Error.unAuthorizedWithAuth)
            }

            res.status(401)
            throw new Error(ResponseMessage.Error.unAuthorized)
        }
    } else {
        res.status(401)
        throw new Error(ResponseMessage.Error.unAuthorized)
    }
}) 