describe("Api Error Handler V2 Happy Path", () => {
    const freshEnv = process.env;

    let resJson;
    let resStatus;
    let redirect;

    let req,
        res,
        next;

    beforeEach(async () => {
        jest.resetModules();
        jest.clearAllMocks();

        process.env.aws_error_service_catalog_table = "fake_aws_error_service_catalog_table";

        resJson = jest.fn();
        resStatus = jest.fn();
        redirect = jest.fn();

        res = {
            status: resStatus,
            json: resJson,
            redirect: redirect,
            locals: {
                requestId: "request_id_001",
                serviceName: "fake_service",
            }
        };

        resJson.mockImplementation(() => res);
        resStatus.mockImplementation(() => res);
        next = jest.fn();

        req = {
            headers: {
                orgid: "test_org_id",
                "x-api-key": "apikey-1122"
            },
            method: "POST",
            host: "https://test.com",
            originalUrl: "/step/v1",
            get: (n) => {
                if (n === "host")
                    return "https://test.com"
                else
                    return "unknown host"
            }
        };
    });

    afterEach(async () => process.env = freshEnv );

    test("Respond with 500 status code", async () => {
        expect.hasAssertions();

        //mock executor for dynamoDB
        const AWS = require("aws-sdk");
        AWS.DynamoDB.__mock_update.mockImplementationOnce(() => {
            return {
                promise: async () => Promise.resolve({
                    Attributes: { counter: 1 }
                })
            }
        });

        const { respondWithErrorResponse } = require("../../handlers/api_error_handler_v1.js");
        const expectedErrorBody = await respondWithErrorResponse({
            err: new Error("Api Gateway Server Timeout"),
            req,
            res,
            statusCode: 500,
        });

        expect(resStatus).toHaveBeenCalledWith(500);
        expect(resJson).toHaveBeenCalledWith({
            success: "error",
            api_info: {
                request_id: "request_id_001",
                method: "POST /step/v1",
                uri: "https://test.com/step/v1"
            },
            error_code: "NULL-1001",
            error: {
                message: "Api Gateway Server Timeout",
                data: null,
            }
        });
        expect(next).not.toHaveBeenCalledWith();
    })
});