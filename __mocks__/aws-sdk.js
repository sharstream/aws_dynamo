"use strict";
const AWS = jest.createMockFromModule("aws-sdk");

const _build_aws_promise_wrapper = (payload, should_reject) => {
    return {
        promise: () => (!!should_reject ? Promise.reject(payload) : Promise.resolve(payload)),
    };
};

const mock_update = jest.fn(() => _build_aws_promise_wrapper({}));
const DocumentClient = jest.fn().mockImplementation(() => {
    return {
        update: mock_update,
    };
});

AWS.DynamoDB.DocumentClient = DocumentClient;
AWS.DynamoDB.__mock_update = mock_update;

module.exports = AWS;
