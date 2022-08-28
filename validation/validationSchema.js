const { body } = require("express-validator");
const { G_User, G_Post } = require('../global')

const addUserSchema = [
  body("username")
    .isLength({ min: G_User.USERNAME_MIN, max: G_User.USERNAME_MAX })
    .withMessage(`Username must be at least ${G_User.USERNAME_MIN} and no more than ${G_User.USERNAME_MAX} characters`),
  body("password")
    .isLength({ min: G_User.PASSWORD_MIN, max: G_User.PASSWORD_MAX })
    .withMessage(`Password must be at least ${G_User.PASSWORD_MIN} and no more than ${G_User.PASSWORD_MAX} characters.`),
  body("email")
    .isLength({ min: G_User.EMAIL_MIN, max: G_User.EMAIL_MAX })
    .withMessage(`Email Address must be at least ${G_User.EMAIL_MIN} and no more than ${G_User.EMAIL_MAX} characters.`),
];

const POST_STATUS = ["Posted"];
const POST_AUDIENCE = ["Public", "Private"];

const addPostSchema = [
  body("body")
    .isLength({ min: G_Post.BODY_MIN, max: G_Post.BODY_MAX })
    .withMessage(`Body must be at least ${G_Post.BODY_MIN} and no more than ${G_Post.BODY_MAX} characters.`),
  body("status")
    .isIn(POST_STATUS)
    .withMessage("Value must be posted"),
  body("audience")
    .isIn(POST_AUDIENCE)
    .withMessage("Post audience can be either, Public or Private."),
];

const loginUserSchema = [
  body("username").notEmpty().withMessage("Username field is required."),
  body("password").notEmpty().withMessage("Password field is required."),
];

const verifyPasswordSchema = [
  body("password").notEmpty().withMessage("Password field is required."),
];

const userVisibilitySchema = [
  body("visibility").isBoolean().withMessage("Must be a boolean value"),
];

const updatePasswordSchema = [
  body("oldPassword").notEmpty().withMessage("Old password field is required."),
  body("newPassword")
    .isLength({ min: 4, max: 16 })
    .withMessage(
      "New password must must be at least 4 and no more than 16 characters."
    ),
];

const addAndUpdateCommentSchema = [
  body("comment").notEmpty().withMessage("Comment cannot be empty"),
];

const addLikeToPostSchema = [
  body("isLiked").isBoolean(true).withMessage("IsLiked must be a boolean value")
]

const SUPPORTED_FORMATS = ['csv', 'txt']
const exportDataSchema = [
  body('type').notEmpty().withMessage('File type cannot be empty'),
  body('type').isIn(SUPPORTED_FORMATS).withMessage(`Supported formats are ${[...SUPPORTED_FORMATS]}.`)
]

const forgotPasswordSchema = [
  body('email').notEmpty().withMessage('Email address is required')
]

const checkEmailSchema = [
  body('email').notEmpty().withMessage('Email address is required')
]

const resetPasswordSchema = [
  body('password').isLength({ min: G_User.PASSWORD_MIN, max: G_User.PASSWORD_MAX })
    .withMessage(`Password must be at least ${G_User.PASSWORD_MIN} and no more than ${G_User.PASSWORD_MAX} characters.`),
]

module.exports = {
  addUserSchema,
  checkEmailSchema,
  resetPasswordSchema,
  addPostSchema,
  loginUserSchema,
  updatePasswordSchema,
  addAndUpdateCommentSchema,
  addLikeToPostSchema,
  verifyPasswordSchema,
  userVisibilitySchema,
  exportDataSchema,
  forgotPasswordSchema
};
