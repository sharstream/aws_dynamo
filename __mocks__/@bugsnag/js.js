module.exports = jest.mock("@bugsnag/js", () => () => {
    return {
        use: (express) => "fake_express_middleware",
        getPlugin: (express) => ({
            requestHandler: function (req, res, next) {
                return next()
            },
            errorHandler: function(req, res, next) {
                return next()
            }
        })
    }
})