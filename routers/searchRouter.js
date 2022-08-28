const express = require("express");
const router = express.Router();
const Users = require('../models/userModel')
const Posts = require('../models/postModel')
const auth = require('../middlewares/auth')
const asyncHandler = require("express-async-handler");

router.get('/', auth, asyncHandler(async (req, res) => {
    const { keyword } = req.query
    const regex = new RegExp(keyword, 'i')

    const users = await Users.find({ username: regex, active: true }).select('username').limit(10)
    const posts = await Posts.find({ body: regex, active: true, audience: "Public" })
        .select('body owner createdAt likes comments')
        .limit(10)
        .populate('owner', 'username')
        .sort({ createdAt: -1 })

    return res.json({ data: { users, posts } })
}))

module.exports = router;