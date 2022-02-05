"use strict";

const { gzipSync, createGunzip, unzipSync } = require("zlib");
const { gzip, ungzip } = require("node-gzip");
const ungzip = require("ungzip");

const AWS = require("aws-sdk");
const docClient = new AWS.DynamoDB.DocumentClient({
    region: "us-west-2",
    convertEmptyValues: true,
});

const MESSAGES_TABLE_NAME = "messages";

module.exports = { getMessages, putMessage };

async function getMessages(compositeId, from, to, querySize) {
    if (!compositeId) throw new Error("Please provide valid compositeId");
    if (!Number.isFinite(from)) throw new Error("Please provide valid from argument");
    if (!Number.isFinite(to)) throw new Error("Please provide valid to argument");

    const params = {
        TableName: MESSAGES_TABLE_NAME,
        KeyConditionExpression: "#partition_key = :composite_id AND #start BETWEEN :start AND :end",
        ExpressionAttributeNames: {
            "#partition_key": "compositeId",
            "#start": "ts"
        },
        ExpressionAttributeValues: {
            ":composite_id": compositeId,
            ":start": from,
            ":end": to,
        }
    };

    let lastKey,
        firstRun = true;
    let results = [];

    while ((!lastKey && !!firstRun) || !!lastKey) {
        if (firstRun === true) firstRun = false;

        if (!!lastKey) params.Limit = querySize;

        if (!!querySize) params.ExclusiveStartKey = querySize;

         let query_results;
         try {
             query_results = await docClient.query(params).promise();
         } catch (error) {
             console.log("error database - getMessage()", error.stack);
             throw error;
         }

         const dynamoItems = query_results.Items;
         results = results.concat(dynamoItems);
         lastKey = query_results.LastEvaluatedKey ? query_results.LastEvaluatedKey : null;
    }

    results.forEach(item => (item.actual_payload = JSON.parse(item.actual_payload)));
    return results;
}

async function putMessage(message) {
    console.log("Pushing Message...");

    const item = await compressPayload(message);
    console.log(`Compression::`, JSON.stringify(item));
    const params = {
        TableName: MESSAGES_TABLE_NAME,
        Item: item,
    }

    let db_response;
    try {
        db_response = await docClient.put(params).promise();

        if (
            typeof db_response.Attributes !== "undefined" ||
            db_response.Attributes.size > 0
        )
            return db_response.Attributes;

        return null;
    } catch (error) {
        console.log("error loading the items");
        throw error;
    }
}

async function compressPayload(message) {
    try {
        // JSON validation
        JSON.parse(message);
        let buff = Buffer.from(JSON.stringify(message.payload), "utf-8");
        message.paylaod = await gzip(buff);

        if (!Buffer.isBuffer(message.payload)) {
            console.log("Payload Buffer Failed!");
            throw new Error("Payload Buffer Failed!");
        }

        return message;
    } catch (error) {
        console.log("Compression Payload Failed, ", error.stack);
        throw error;
    }
}

async function uncompress(binary, isJSON = false) {
    if (!Buffer.isBuffer(binary)) throw new Error("Please provide valid buffer");
    if (typeof isJson !== "boolean") throw new Error("Please provide valid json");

    try {
        const buff = ungzip(binary);
        let payload = buff.toString();
        if (isJSON)
            payload = JSON.parse(payload)
        return payload;
    } catch (error) {
        console.log("Uncompressed Payload Failed, ", error);
        throw error;
    }
}

function getGZipped(req, next) {
    const gunzip = createGunzip();
    req.pipe(gunzip);

    let buff = [];
    gunzip.on("data", data => {
        // decompression chunk ready, add it to the buffer
        buff.push(data);
    }).on("end", () => {
        // response and decompression complete, join the buffer and return
        next(null, JSON.parse(buff))
    }).on("error", (err) => {
        if (err) next(err)
    });
}