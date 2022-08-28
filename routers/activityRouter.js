const express = require("express");
const router = express.Router();
const ActivitiesController = require('../controllers/activitiesController')
const auth = require('../middlewares/auth')
const verifyParamAndPermission = require('../middlewares/verifyParamAndPermission')

router
    .get('/:id',
        auth,
        verifyParamAndPermission({ model: "Users", param: "id" }),
        ActivitiesController.getActivities)

module.exports = router;