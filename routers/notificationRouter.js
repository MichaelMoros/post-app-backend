const express = require("express");
const router = express.Router();
const NotificationController = require('../controllers/notificationController')
const auth = require('../middlewares/auth')
const verifyParamAndPermission = require('../middlewares/verifyParamAndPermission')

router
    .get('/:id',
        auth,
        verifyParamAndPermission({ model: "Users", param: "id" }),
        NotificationController.getNotifications)

module.exports = router;