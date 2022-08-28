const express = require("express");
const router = express.Router();
const auth = require('../middlewares/auth')
const PostController = require('../controllers/postController')
const { addPostSchema, addAndUpdateCommentSchema, addLikeToPostSchema, getComments } = require('../validation/validationSchema')
const ValidateSchema = require('../validation/validateSchema')
const { optionalAuth } = require('../middlewares/optionalAuth')
const verifyParamAndPermission = require('../middlewares/verifyParamAndPermission')

router
    .post('/', auth, ValidateSchema(addPostSchema), PostController.addNewPost)
    .get('/v1', auth, PostController.getPostWithParams)
    .post('/:postId/comment', auth, ValidateSchema(addAndUpdateCommentSchema), PostController.addComment)
    .get('/:postId/comments', optionalAuth, PostController.getComments)
    .post('/:postId/like', auth, ValidateSchema(addLikeToPostSchema), PostController.toggleLike)

router
    .route('/:postId')
    .get(optionalAuth, PostController.getOnePostFull)
    .put(auth, verifyParamAndPermission({ model: "Posts", param: "postId" }), PostController.updatePost)
    .delete(auth, verifyParamAndPermission({ model: "Posts", param: "postId" }), PostController.deletePost)

module.exports = router;
