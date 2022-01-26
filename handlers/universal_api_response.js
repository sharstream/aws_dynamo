"use strict";

const statusCodeMessageGet = new Map([
    [200, "The request has succeeded"],
    [201, "The request has succeeded and a new resource has been created"],
    [202, "The request has been received but not yet acted upon"],
    [204, "The request has succeeded. There is not content to send for this request"],
    [400, "The server could not understand the request due to invalid syntax"],
    [401, "The client must authenticate itself to get the requested response"],
    [403, "The client does not have the right access to the content"],
    [404, "The server can not find the requested resource"],
    [405, "The method is not allowed"],
    [409, "The request conflicts with the current state of the server"],
    [500, "Internal server error"]
])

module.exports = { generateResponseBody, generateErrorResponseBody };

/**
 * 
 * @param {Object} req express request object 
 * @param {Object} res res express response object 
 * @param {Object} data json data to send 
 * @param {Number} statusCode http status code
 * @returns 
 */
function generateResponseBody(req, res, data, statusCode) {
    if (Number.isNaN(statusCode)) {
        throw new Error("Invalid or missing statusCode");
    }

    return {
        status: "ok",
        code: statusCode,
        message: (statusCodeMessageGet.get(statusCode) || null),
        context: (res.locals.context || null),
        api_info: {
            api_version: (res.locals.version || null),
            api_id: (res.locals.apiId || null),
            uri: req.get("host") + req.originalUrl,
            method: `${req.method} ${req.orignialUrl}`,
            request_id: res.locals.requestId,
            metadata: []
        },
        general_info: [],
        data: (data || null)
    };
}

/**
 * 
 * @param {Object} err node error object
 * @param {Object} req express request object
 * @param {Object} res express response object 
 * @param {Number} statusCode 
 * @returns 
 */
function generateErrorResponseBody(err, req, res, statusCode) {
    if (Number.isNaN(statusCode))
        statusCode = 500;

    let eb = {
        status: "error",
        code: statusCode,
        message: statusCodeMessageGet.get(statusCode),
        context: (res.locals.context || null),
        api_info: {
            request_id: res.locals.requestId,
            method: `${req.method} ${req.originalUrl}`,
            uri: req.get("host") + req.originalUrl
        },
        general_info: [],
        error_code: generate_error_code(statusCode, res.locals.serviceName),
        error: {
            messages: {
                developer_msg: (statusCode !== 500) ? err.message : "Internal Server Error",
                user_msg: statusCodeMessageGet.get(statusCode)
            },
            send_report: null,
            more_info: null,
            errors: []
        }
    }

    if (eb.code !== 500) {
        const eClean = {
            code: err.code,
            message: err.message,
            stack: (res.locals.sendstack) ? err.stack : undefined
        }
        eb.error.errors.push(eClean);
    }

    return eb;
}

/**
 * @desc structure new error format
 * @param {Number} statusCode 
 * @param {String} serviceName 
 * @returns 
 */
function generate_error_code(statusCode, serviceName) {
    let code = "",
        increment = 1000;
    console.log("arguments:: ", statusCode, serviceName);
    if (statusCode >= 200 && statusCode <= 300 )
        return code;
    
    switch (statusCode) {
        case 400:
            code = `${serviceName}_${increment+1}`
            break;
        case 429:
            code = `${serviceName}_0${statusCode}`;
            break;
        case 500:
            code = `${serviceName}_0${statusCode}`;
            break;
        default:
            break;
    };

    return code;
} 

const serviceNamesGet = new Map([
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
    ["Live Ingestions", "LI"],
    ["OAuth", "OA"],
    ["OEM", "OM"],
    ["Premium Data", "PD"],
    ["Routing/Scheduling", "RS"],
    ["Territories", "TR"],
    ["Thematic Mapping", "TM"]
])

const mock_req = {
    headers: {
        orgid: "test_org_id",
        "x-api-key": "api gateway key"
    },
    method: "POST",
    originalUrl: "https://api.test.everything",
    protocol: "https",
    get: (n) => {
        if (n === "host")
            return "test_host"
        else
            return "unknown host"
    }
}

const mock_res = {
    locals: {
        version: "1.0.0",
        apiId: "apigateway id",
        requestId: "request id",
        context: { foo: "context" },
        serviceName: serviceNamesGet.get("Live"),
    }
}

const result = generateErrorResponseBody(new Error("Rate Limit"), mock_req, mock_res, 400);
console.log(`responseBody::${JSON.stringify(result)}`)