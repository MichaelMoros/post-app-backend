const jwt = require('jsonwebtoken')
const ResponseMessage = require('../helpers/responseMessage')
const Users = require('../models/userModel')
const asyncHandler = require("express-async-handler");

// @desc     Validate and generate new access token
// @route    GET /refresh-token
// @access   public
exports.validateRefreshToken = asyncHandler(async (req, res) => {
    const cookies = req.cookies

    if (!cookies?.jwt) {
        res.status(401)
        throw new Error(ResponseMessage.Error.unAuthorized)
    }

    const refreshToken = cookies.jwt

    const foundUser = await Users.findOne({ refreshToken, active: true }).select('refreshToken')

    if (!foundUser) {
        res.status(403)
        throw new Error(ResponseMessage.Error.unAuthorizedWithAuth)
    }

    const userRefreshToken = foundUser.refreshToken

    jwt.verify(userRefreshToken, process.env.REFRESH_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            console.error(err.stack)
            res.status(403)
            throw new Error(ResponseMessage.Error.unAuthorizedWithAuth)
        }

        if (decoded._id.toString() !== foundUser._id.toString()) {
            res.status(403)
            throw new Error(ResponseMessage.Error.unAuthorizedWithAuth)
        }

        const { username, _id } = decoded

        const accessToken = jwt.sign({ username, _id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "5m" })

        return res.status(200).json({ accessToken })
    })
})
