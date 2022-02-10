"use strict";

const DynamoClient = require("../clients/dynamo-client.js");
const AWS_ERROR_SERVICE_CATALOG_TABLE = process.env.aws_error_service_catalog_table;
const serviceNamesGetMap = new Map([
    ["Advanced Routing", "AR"],
    ["Arc GIS", "AG"],
    ["Authorization", "AZ"],
    ["Auto Assignments", "AA"],
    ["Email", "EM"],
    ["Geocoding", "GC"],
    ["Geometry", "GY"],
    ["GIS", "GS"],
    ["Images", "IG"],
    ["Live", "LV"],
    ["Tile", "TL"],
    ["Live Ingestions", "LI"],
    ["OAuth", "OA"],
    ["OEM", "OM"],
    ["Premium Data", "PD"],
    ["Routing/Scheduling", "RS"],
    ["Territories", "TR"],
    ["Thematic Mapping", "TM"],
]);

module.exports = { respondWithErrorResponse };

/**
 * @desc function interface to implement internationalization error codes for middlewares
 *
 * @param {object} err node error object
 * @param {object} req express request object
 * @param {object} res express response object
 * @param {number} statusCode original http status code to 500
 * @param {string} errorCode (Optional) unique error code to this service and each error catalog. Used for translation internationalization. If not provided explicity
 * @param {object} data optional parameter
 * @returns {HTTP Response}
 */
async function respondWithErrorResponse(parameters) {
    let { err, req, res, statusCode } = parameters;

    if (Number.isNaN(statusCode)) {
        statusCode = 500;
        err.message = "Internal Server Error";
    }

    const serviceName = res.locals.serviceName || "Tile";

    let eb = {
        success: "error",
        api_info: {
            uri: req.get("host") + req.originalUrl,
            method: `${req.method} ${req.originalUrl}`,
            request_id: res.locals.requestId,
        },
        error: {
            message: err.message,
            data: _build_error_data(err),
        },
    };

    try {
        eb.error_code = _build_error_code(
            res.locals.serviceName,
            statusCode,
            await _increment_error_counter(`${res.locals.requestId}-${serviceName}`)
        );

        return res.status(statusCode).json(eb);
    } catch (error) {
        eb.error.message = error.message;
        res.status(500).json(eb);
    }
}

function _build_error_code(serviceName, statusCode, atomicCounter) {
    let error_code, internal_error_code;

    if (Number.isNaN(atomicCounter) || Number.isFinite(atomicCounter)) 
        atomicCounter = 1;

    if (statusCode > 500) 
        internal_error_code = `0${statusCode}`;
    else if (statusCode > 400 && statusCode < 500) 
        internal_error_code = `0${statusCode}`;
    else {
        switch (true) {
            case atomicCounter <= 9:
                internal_error_code = `100${atomicCounter}`;
                break;
            case atomicCounter <= 99:
                internal_error_code = `10${atomicCounter}`;
                break;
            case atomicCounter <= 999:
                internal_error_code = `1${atomicCounter}`;
                break;
            default:
                internal_error_code = `100${atomicCounter}`;
                break;
        }
    }

    if (!serviceNamesGetMap.has(serviceName)) {
        serviceNamesGetMap.set(serviceName, "Unknown");
        error_code = `NULL-${internal_error_code}`;
    } else {
        error_code = `${serviceNamesGetMap.get(serviceName)}-${internal_error_code}`;
    }

    return error_code;
}

function _build_error_data(err) {
    if (err.hasOwnProperty("data"))
        return {
            ...err.data,
        };

    let property;
    if (err.message.startsWith("Missing Required Parameter")) 
        property = `${err.message.split(/(\s)/)[6]}`;
    else if (err.message.startsWith("Invalid Parameter")) 
        property = `${err.message.split(/(?:'|")(.*)(:?'|")/)[1]}`;

    return property ? { property: property } : null;
}

/**
 * @desc provide a confortable way to use atomic counter on a numeric attribute to update 4XX error codes
 * 
 * @param {String} partitionKey 
 * @returns {Number} atomic counter being incremented
 */
async function _increment_error_counter(partitionKey) {
    if (!partitionKey) throw new Error("Partition key is not declared");
    
    const primaryKey = 'partition_error_service_key',
        dynamo = new DynamoClient(AWS_ERROR_SERVICE_CATALOG_TABLE, primaryKey);

    let MAX_THRESHOLD_LIMIT = 999;

    const updateExp = "SET #c = #c + :incr",
        conditionExp = "attribute_exists(partition_error_service_key) AND #c < :MAX",
        expAttr = { "#c":  "counter" },
        expVal = { 
            ":incr": 1,
            ":MAX": MAX_THRESHOLD_LIMIT,
        },
        returnValues = "ALL_NEW";

    try {
        const db_response = await dynamo.update(partitionKey, updateExp, conditionExp, expAttr, expVal, returnValues);

        if (!db_response.hasOwnProperty("Attributes"))
            return 1;

        let { counter } = db_response["Attributes"];
     
        return counter;
    } catch (error) {
        if (error.hasOwnProperty("code") && error.code === "ConditionalCheckFailedException") {
            await _reset_error_counter(partitionKey);
            return 1;
        } else if (error.hasOwnProperty("code") && error.code === "") {
            error.message = "Unhandled exception from database"
        }
            
        throw error;
    }
}

async function _reset_error_counter(partitionKey) {
    if (!partitionKey) throw new Error("Partition key is not declared");
    
    const primaryKey = 'partition_error_service_key',
        dynamo = new DynamoClient(AWS_ERROR_SERVICE_CATALOG_TABLE, primaryKey);

    const updateExp = "SET #c = #c + :incr",
        conditionExp = "attribute_exists(partition_error_service_key) AND #c < :MAX",
        expAttr = { "#c":  "counter" },
        expVal = { 
            ":incr": 1,
            ":MAX": MAX_THERSHOLD_LIMIT,
        },
        returnValues = "ALL_NEW";

    await dynamo.update(partitionKey, updateExp, conditionExp, expAttr, expVal, returnValues)
}
 