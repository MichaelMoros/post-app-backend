const Users = require('../models/userModel')
const Posts = require('../models/postModel')
const Comments = require('../models/commentModel')
const ResponseMessage = require('../helpers/responseMessage')
const isValidObjectId = require('../helpers/isValidObjectId')

const FOREIGN_KEY = {
    Users: "_id",
    Posts: "owner",
    Comments: "owner"
}

/**
* @param {{ model, param }} - Model and param as lookup
* @returns {Model Object} - Returns model object base on object.model param 
*/
const verifyParamAndPermission = (object) => {
    return async (req, res, next) => {
        const { model, param } = object
        const validObjectId = isValidObjectId(req.params[param])
        if (!validObjectId) return res.status(404).json({ error: ResponseMessage.Error.notFound })

        const searchParam = req.params[param]

        let result;

        try {
            switch (model) {
                case "Users":
                    result = await Users.findOne({ _id: searchParam, active: true })
                    break;
                case "Posts":
                    result = await Posts.findOne({ _id: searchParam, active: true })
                    break;
                case "Comments":
                    result = await Comments.findOne({ _id: searchParam, active: true })
                    break;
                default:
                    result = null
                    break;
            }

            if (!result) {
                return res.status(404).json({
                    error: {
                        code: 404,
                        message: ResponseMessage.Error.notFound
                    }
                })
            }

            else if (req.user?._id.toString() !== result[FOREIGN_KEY[model]].toString()) {
                return res.status(403).json({
                    error: {
                        code: 404,
                        message: ResponseMessage.Error.unAuthorizedWithAuth
                    }
                })

            } else {
                req.locals = result
                next()
            }
        } catch (err) {
            res.status(500)
            throw new Error(ResponseMessage.Error.serverError)
        }
    }
}


module.exports = verifyParamAndPermission