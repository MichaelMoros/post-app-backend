const bcrypt = require("bcrypt");

const createHashedPassword = async (password) => {
    const SALT_ROUNDS = 10
    return await bcrypt.hash(password, SALT_ROUNDS);
}

module.exports = createHashedPassword 