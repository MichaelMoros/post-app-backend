const express = require("express");
const router = express.Router();
const RefreshTokenController = require('../controllers/refreshTokenController')


router.get('/', RefreshTokenController.validateRefreshToken)
module.exports = router;