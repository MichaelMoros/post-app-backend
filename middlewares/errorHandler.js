const errorHandler = (err, req, res, next) => {
    if (err.name === "ValidationError") {
        res.status(400)
        let _errors = { code: 400 }

        Object.keys(err.errors).forEach(error => {
            _errors[error] = err.errors[error].message
        })

        return res.status(400).json({
            errors: _errors
        })

    } else {
        const statusCode = res.statusCode ? res.statusCode : 500
        return res.status(statusCode).json({
            error: {
                code: statusCode,
                message: err.message
            }
        })
    }
}


module.exports = {
    errorHandler
}