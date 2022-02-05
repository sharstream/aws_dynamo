const winston = require("winston");

module.exports = { defaultLogger, loggerInfo };

const defaultLogger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.splat(),
        winston.format.simple()
    ),
    transports: [
        new winston.transport.Console({
            format: winston.format.simple(),
            handleExceptions: true
        })
    ]
})

function loggerInfo(err, req, res) {
    
}