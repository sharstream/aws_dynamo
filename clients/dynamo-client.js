"use strict";

const AWS = require("aws-sdk");
const https = require("https");

/**
 * @params {String} tableName table name for database instance table
 * @params {String} parititionKey database partition key for records
 * @params {String} aws region (optional) in case AWS service defined one for you automatically
 */
module.exports = class {
    constructor(tableName, primaryKey, awsRegion) {
        // super();
        if (!tableName) throw new Error("Table name is not declared");
        if (!primaryKey) throw new Error("Primary key is not declared");

        this.tableName = tableName;
        this.primaryKey = primaryKey;

        this.client = new AWS.DynamoDB.DocumentClient({
            service: new AWS.DynamoDB({
                httpOptions: {
                    agent: new https.Agent({
                        ciphers: "ALL",
                        secureProtocol: "TLSv1_method",
                    })
                }
            })
        })
    }

    async update(id, updateExpress, condition, expressionAttr, expressionVal, returnValues) {
        let params;
        if (typeof id === "string") {
            let key = {};
            key[this.primaryKey] = id;
            params = {
                TableName: this.tableName,
                Key: key,
                UpdateExpression: updateExpress,
                ConditionExpression: condition,
                ExpressionAttributeNames: expressionAttr,
                ExpressionAttributeValues: expressionVal,
                ReturnValues: returnValues,
            }
        } else {
            params = id;
            params.TableName = this.tableName;
        }

        try {
            const db_response = await this.client.update(params).promise();
            return db_response;
        } catch (error) {
            throw error;
        }
    }
}