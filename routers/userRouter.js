const express = require("express");
const router = express.Router();
const UserController = require('../controllers/userController')
const ValidateSchema = require('../validation/validateSchema')
const {
      addUserSchema,
      loginUserSchema,
      exportDataSchema,
      updatePasswordSchema,
      verifyPasswordSchema,
      userVisibilitySchema,
      forgotPasswordSchema,
      checkEmailSchema,
      resetPasswordSchema
} = require('../validation/validationSchema')
const auth = require('../middlewares/auth')
const { optionalAuth } = require('../middlewares/optionalAuth')
const verifyParamAndPermission = require('../middlewares/verifyParamAndPermission')



router
      .post('/',
            ValidateSchema(addUserSchema),
            UserController.createUser
      )
      .post('/login',
            ValidateSchema(loginUserSchema),
            UserController.loginUser
      )
      .post('/forgot-password',
            ValidateSchema(forgotPasswordSchema),
            UserController.generatePasswordLink
      )
      .get('/resume-session',
            UserController.resumeSession
      )
      .get('/check-email-availability/:email',
            UserController.checkEmailAvailability
      )
      .get('/check-username-availability/:username',
            UserController.checkUsernameAvailability
      )
      .get('/:id',
            optionalAuth,
            UserController.getUserDetails
      )
      .post('/:id/logout',
            auth,
            verifyParamAndPermission({ model: "Users", param: "id" }),
            UserController.logout
      )
      .put('/:id/deactivate',
            auth,
            verifyParamAndPermission({ model: "Users", param: "id" }),
            UserController.deactivateAccount)
      .delete('/:id/delete-account',
            auth,
            verifyParamAndPermission({ model: "Users", param: "id" }),
            UserController.deleteAccount)
      .post('/:id/verify-password',
            auth,
            ValidateSchema(verifyPasswordSchema),
            verifyParamAndPermission({ model: "Users", param: "id" }),
            UserController.verifyPassword)
      .put('/:id/visibility',
            auth,
            ValidateSchema(userVisibilitySchema),
            verifyParamAndPermission({ model: "Users", param: "id" }),
            UserController.updateAccountVisibility)
      .put('/:id/password',
            auth,
            ValidateSchema(updatePasswordSchema),
            verifyParamAndPermission({ model: "Users", param: "id" }),
            UserController.updatePassword)
      .get('/:id/profile',
            auth,
            verifyParamAndPermission({ model: "Users", param: "id" }),
            UserController.getProfileDetails)

      .get('/:id/export',
            auth,
            verifyParamAndPermission({ model: "Users", param: "id" }),
            UserController.generateActivityLog)

router
      .route('/reset-password/:userId/:token')
      .get(UserController.resetPassword)
      .post(ValidateSchema(resetPasswordSchema), UserController.resetPasswordFromRecovery)



module.exports = router;
