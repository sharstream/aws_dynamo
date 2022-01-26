"use strict";

const https = require("https");
const router = require("express").Router();
const universal_api = require("../handlers/universal_api_response");
const { respondWithError } = require("../handlers/error_handler_v1");

router.get("/v1", (req, res) => {
    if (!req.query.endpoint) {
        const e = new Error("No endpoint was specified to proxy");
        const body = universal_api.generateErrorResponseBody(e, req, res, 400);
        return res.status(body.code).json(body)
    }

    if (!matchesTopLevelDomain(req.query.endpoint, "com", "path")) {
        const e = new Error("Cannot proxy this request");
        const body = universal_api.generateErrorResponseBody(e, req, res, 400);
        return res.status(body.code).json(body)
    }

    const _req = https.get(req.query.endpoint, (_res) => {
        let data = "";
        _res.on("data", (chunk) => data += chunk )
        _res.on("end", () => {
            res.status(_res.statusCode);

            try {
                const resJson = JSON.parse(data);
                res.send(resJson);
            } catch (proxyErr) {
                console.log("Proxy parse error", proxyErr);
                const error = new Error(data);
                const body = universal_api.generateErrorResponseBody(error, req, res, 502);
                return res.status(body.code).json(body);
            }
        });

        _res.on("error", (error) => {
            console.log("Proxy parse error", proxyErr);
            const body = universal_api.generateErrorResponseBody(error, req, res, 500);
            return res.status(body.code).json(body);
        });


    })
})

router.use("/version?", async (req, res) => {
    const error = new Error("Methods not allowed");
    return respondWithError({ error, req, res, statusCode: 405, errorCode: "0405" })
})

function matchesTopLevelDomain(url, top, second) {
    url = url.replace(/^https?:\/\//, "");
    let index = null;
    
    if ((index = url.indexOf("/")) >= 0)
        url = url.substr(0, index);
    
    const parts = url.split(".");
    return (
        parts.length >= 2 && 
        parts[parts.length - 1] === top && 
        parts[parts.length - 2] === second
    )
}

module.exports = router;