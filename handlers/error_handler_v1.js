
module.exports = { respondWithError };

/**
 * 
 * @param {object} err node error object 
 * @param {object} req express request object
 * @param {object} res express response object
 * @param {number} statusCode original http status code to 500
 * @param {string} errorCode unique error code to this service and each error catalog. Used for translation internationalization. If not provided explicity
 * @param {object} data optional parameter
 */
async function respondWithError(params) {
    let { err, req, res, statusCode, errorCode } = params;

    if (Number.isNaN(statusCode)) {
        statusCode = 500;
        errorCode = "0500";
    }

    if (errorCode === "0500") {
        err.message = "Internal Server Error";
    }

    let eb = {
        status: "error",
        api_info: {
            uri: req.get("host") + req.originalUrl,
            method: `${req.method} ${req.originalUrl}`,
            request_id: res.locals.requestId,
        },

        error_code: generate_error_code(statusCode, errorCode, res.locals.serviceName) || `AG-${errorCode}`,
        error: {
            messages: err.message,
            data: err.data || null,
        }
    }

    return res.status(statusCode).json(eb);
}

function generate_error_code(statusCode, errorCode, serviceName) {
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

    let code = "";

    if (statusCode >= 200 && statusCode <= 300 )
        return code;

    if (serviceNamesGet.has(serviceName)) {
        code = `${serviceName}_${errorCode}`;
    }

    return code;
}