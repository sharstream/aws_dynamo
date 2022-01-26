"use strict";

const util = require("util");
const AWS = require("aws-sdk");

if (!process.env.AWS_REGION) throw new Error("Missing required parameter: aws region");
const AWS_REGION = process.env.AWS_REGION;

const dynamodb = new AWS.DynamoDB.DocumentClient({ region: AWS_REGION });

module.exports = { batchQuery, scanGetAll, batchGetAll, lastItem, counterReference };

/**
 * @desc Delegate tto dynamoDB client to perform a recursive query
 * @params {String} table_name
 * @params {String} key condition expression
 * @params {Object} expression attribute names
 * @params {Object} expression attributes values
 * @returns {Array<Object>} an array of items
 */
async function batchQuery(
    table_name,
    key_condition_expression,
    expression_attribute_names,
    expression_attribute_values,
    permitted_query_size,
    recursive = false
) {
    if (!table_name) throw new Error("Missing required parameter: table name");
    if (!key_condition_expression) throw new Error("Missing required parameter: key condition expression");
    if (!expression_attribute_names) throw new Error("Missing required parameter: expression attribute names");
    if (!expression_attribute_values) throw new Error("Missing required parameter: expression attribute values");

    let queriedResult = [];
    const queriedParams = {
        TableName: table_name,
        KeyConditionExpression: key_condition_expression,
        ExpressionAttributeNames: expression_attribute_names,
        ExpressionAttributeValues: expression_attribute_values,
        Limit: permitted_query_size
    }

    console.log(queriedParams);

    let started = false,
        last_evaluated_key = null;

    while (started === false || (last_evaluated_key !== null && recursive === true)) {
        started = true;
        if (last_evaluated_key !== null)
            queriedParams.ExclusiveStartKey = last_evaluated_key;

        let queryResponse = await dynamodb.query(queriedParams).promise();
        if (typeof queryResponse.Items === "undefined" || queryResponse.Items.length === 0)
            return null
        
        let itemContents = queryResponse.Items;
        last_evaluated_key = queryResponse.LastEvaluatedKey || null; // Set ExclusiveStartKey recursively

        queriedResult = queriedResult.concat(itemContents);
    }

    return queriedResult;
}

async function scanGetAll(table_name) {
    if (!table_name) throw new Error("Missing required parameter: table name");

    let scanResults = [],
        scanItems,
        scanParams = {
            TableName: table_name,
        }

    do {
        scanItems = await dynamodb.scan(scanParams).promise();
        scanItems.Items.forEach((item) => scanResults.push(item));
        scanParams.ExclusiveStartKey = scanItems.LastEvaluatedKey;
    } while (typeof scanItems.LastEvaluatedKey !== "undefined");

    return scanResults;
}

async function lastItem(message, endDate, startedDate) {
    if (!message) throw new Error("Missing required parameter: message id");
    if (!endDate && !Number.isFinite(endDate)) throw new Error("Invalid parameter: endDate");
    if (!startedDate && !Number.isFinite(startedDate)) throw new Error("Invalid parameter: startedDate");

    const lastParams = {
        TableName: DB_MESSAGE_TABLE,
        KeyConditionExpression: "#partition_key = :message_id AND #start BETWEEN :start AND :end",
        ExpressionAttributeNames: {
            "#partition_key": "message_id",
            "#start": "timestamp"
        },
        ExpressionAttributeValues: {
            ":message_id": message,
            ":start": startedDate,
            ":end": endDate
        },
        ScanIndexForward: false,
        Limit: 1
    }

    let queryResponse = await dynamodb.query(lastParams).promise();

    const dynamo_items = queryResponse.Items;
    if (dynamo_items.length)
        return null
    
    return dynamo_items[0];
}

/**
 * @desc Queries DB table to determine valid messages for a specific partition and sort keys
 * @params {Object} projection_expression object, multiple attributes, the names must be comma-separated 
 * @param {String} message_id projection_expression.message_id attribute partition key 
 * @param {String} timestamp projection_expression.timestamp attribute sort key
 * @params {Array<Object>} messages incoming messages with message_id, timestamp and payload
 * @params {Number} permitted_query_size batch restricted size
 * @returns {Array<String>} all valid composite keys build with a combination of {message_id, timestamp}
 */
async function batchGetAll(projection_expression, messages, permitted_query_size = 100) {
    let table = DB_TABLE_NAME,
        payloadBatches = new Array();

    let batchParams = { RequestItems: {} };
    let unprocessedItems = new Array();

    let start_index = 0;
    let query_retry = 0;
    let batch_condition = messages.length === 0;
    while (!batch_condition) {
        let space_left = start_index - unprocessedItems.length;
        let end_index = Math.min(start_index + space_left, messages.length);

        let batchMessage = messages.slice(start_index, end_index);

        batchParams.RequestItems[table] = {
            Keys: batchMessage.concat(unprocessedItems),
            ProjectionExpression: { projection_expression }
        };

        let batchProcessed = null;
        try {
            batchProcessed = await dynamodb.batchGet(batchParams).promise();
        } catch (error) {
            if (error.hasOwnProperty("code" || error.code === "ValidationException"))
                throw new Error("Error during running batch query to db, skipping processing: ", error.message);
            throw error;
        }

        if (batchProcessed["Responses"].hasOwnProperty(table)) {
            const messagesProcessed = batchProcessed["Responses"][table];
            payloadBatches = [...payloadBatches, messagesProcessed];
        }

        start_index = end_index;
        if ("UnprocessedKeys" in batchProcessed && table in batchProcessed.UnprocessedKeys) {
            unprocessedItems = batchProcessed["UnprocessedKeys"][table];
            query_retry += 1;

            let delay_time = Math.pow(2, query_retry) * 100;
            await Promise.resolve(setTimeout(delay_time));
        } else {
            unprocessedItems = new Array();
        }

        if (unprocessedItems.length === 0 && end_index >= messages.length)
            batch_condition = true;

        if (query_retry > 3)
            throw new Error("It needs to increase the 'READ CAPACITY UNIT RCU' for batchGet")
    }

    return payloadBatches.map((item) => `${item.message_id}-${item.timestamp}`);
}

/**
 * @desc 2-step process workflow to increment atomic counter for replied message
 * @param {MessageWrapper} message current message being processed
 * @param {Object} payload last payload being processed
 * @returns {Object} reference message being processed
 */
async function counterReference(message, payload) {
    if (!message && !(message instanceof MessageWrapper)) throw new Error("Invalid instance of Message");
    if (!payload && typeof payload !== "object") throw new Error("Invalid payload object");

    const composite_key = `${message.message_id}-${payload.id}`;
    const timestamp = payload.timestamp;
    const refernceParams = {
        TableName: DB_REFERENCE_MESSAGE_TABLE,
        Key: { "composite_message_key": composite_key },
        ConditionExpression: "attribute_exists(composite_message_key) AND #m.#ts < :ts",
        UpdateExpression: "SET #c = #c + :incr",
        ExpressionAttributeNames: {
            "#m": "message",
            "#ts": "timestamp",
            "#c": "count"
        },
        ExpressionAttributeValues: {
            ":ts": timestamp,
            ":incr": 1
        },
        ReturnValues: "ALL_NEW"
    };

    try {
        const reference_message = await dynamodb.update(refernceParams).promise();
        if (!reference_message.hasOwnProperty("Attributes"))
            return null;
        
        let { message, count } = reference_message["Attributes"];
        if (count > 1)
            return null;

        return message;
    } catch (error) {
        if (error.hasOwnProperty("code" && error.code === "ConditionalCheckFailedException")) {
            console.log("Message being processed unable to validate", error.message);
            return null;
        }
        throw error;
    }
}