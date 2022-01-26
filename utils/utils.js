const { gzip } = require("node-gzip");

module.exports = { compressPayload };

/**
 * @desc function get compression for paylaod message record
 * @param {Object} message device object with payload and timestamp attributes 
 * @returns only compressed payload message
 */
async function compressPayload(message) {
    try {
        const buff = await gzip(JSON.stringify(message.payload));

        if (!Buffer.isBuffer(buff)) {
            console.log("Payload Buffer Failed!");
            throw new Error("Payload Buffer Failed!");
        }

        message.payload = buff;
        return message;
    } catch (error) {
        console.log("Compression Payload Failed, ", error.stack);
        throw error;
    }
}