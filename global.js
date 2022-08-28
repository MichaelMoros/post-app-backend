const G_User = {
    USERNAME_MIN: 4,
    USERNAME_MAX: 16,
    PASSWORD_MIN: 8,
    PASSWORD_MAX: 128,
    EMAIL_MIN: 4,
    EMAIL_MAX: 64
}

const G_Post = {
    BODY_MIN: 1,
    BODY_MAX: 1024,
}

const COOKIE_AGE = 24 * 60 * 60 * 1000
module.exports = { G_User, G_Post, COOKIE_AGE }