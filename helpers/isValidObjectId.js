const ObjectId = require('mongoose').Types.ObjectId;

function isValidObjectId(id) {
    if (ObjectId.isValid(id)) {
        if ((String)(new ObjectId(id)) === id) return true;
        return false;
    } else return false
}

module.exports = isValidObjectId