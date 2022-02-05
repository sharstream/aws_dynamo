"use strict";

const DynamoClient = require("../clients/dynamo-client");
const jwt = require("jsonwebtoken");

module.exports = class {
    constructor(env) {
        if (!env) throw new Error("Environment is not declared");
        if (!process.env.keys_table) throw new Error("Keys table env is not declared");
        if (!process.env.secrets_table) throw new Error("Secret table env is not declared");

        this.authTable = new DynamoClient(process.env.secrets_table, "orgId");
        this.keysDBName = process.env.keys_table;
    }

    async _init() {
        if (this.jwtSign === undefined) {
            const keysDB = new DynamoClient(this.keysDBName, "keyName");
            const record = await keysDB.get("jwtSignature");
            if (record === undefined || record.value === undefined)
                throw new Error("Unable to find jwt signature in database")
            this.jwtSign = record.value;
        }
    }

    async generateToken(payload, clientId) {}

    async validateToken(token, clientId) {}
    
    _generateSignature(clientSecret, maioSign) {
        return `${clientSecret}::${maioSign}`;
    }
}