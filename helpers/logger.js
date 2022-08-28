const logger = (req, res, next) => {
    console.log({
        method: req.method,
        endpoint: req.originalUrl,
        body: { ...req.body },
        authorization: req?.headers?.authorization,
        cookies: req.cookies
    })

    next()
}

module.exports = logger