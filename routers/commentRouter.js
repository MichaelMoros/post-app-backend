const express = require("express");
const router = express.Router();
const CommentController = require('../controllers/commentController')
const auth = require('../middlewares/auth')
const ValidateSchema = require('../validation/validateSchema')
const { addAndUpdateCommentSchema } = require('../validation/validationSchema')
const verifyParamAndPermission = require('../middlewares/verifyParamAndPermission')

router
    .route('/:commentId')
    .put(
        auth,
        ValidateSchema(addAndUpdateCommentSchema),
        verifyParamAndPermission({ model: "Comments", param: "commentId" }),
        CommentController.updateComment)
    .delete(auth, verifyParamAndPermission({ model: "Comments", param: "commentId" }), CommentController.deleteComment)

module.exports = router;