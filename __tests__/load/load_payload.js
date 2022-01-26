"use strict";

const { putMessage } = require("../../services/messages_table_service.js");
const { batchQuery } = require("../../clients/dynamo-client.js");
const uuid = require("uuid/v4");

const userId = "0012345";
const vendorName = "CloudRepair";
const deviceId = "0739042";

const startTime = new Date().getTime() - 1000*60*60*3,
    messageDelay = 8640, // ms frecuency of a message being created
    postDelay = 5; //ms

(async () => {

    // await push_messages();

    const tableName = "messages";
    const keyConditionExpression = "contains(composite_id, :partition) AND #start BETWEEN :start AND :end";
    const attributeNames = {
        "#start": "ts"
    };
    const attributeValues = {
        ":partition": "CloudRepair-0739042-0012345",
        ":start": 1642036210636,
        ":end": 1642122524236,
    };

    const messages = await batchQuery(tableName, keyConditionExpression, attributeNames, attributeValues, 100);
    return messages;
})()
.then(console.log("messages processed"))
.catch(err => {
    if (err && err.code === "ValidationException")
        console.log(err);
    else 
        console.log("Standard Error");
})

async function push_messages(){
    let promises = [];
    for (let i = 0; i < 10000; i++) {
        console.log("pushing new message %d to the messages table, ", i);
        const ts = startTime + (messageDelay * i);
        const message = {
            composite_id: `${uuid()}-${vendorName}-${deviceId}-${userId}`,
            ts: ts,
            ttl: ts,
            payload: {
                position: {
                    latitude: 33.9083953,
                    longitude: -84.2883479,
                    direction: 43
                },
                eventType: "position_update",
                timestamp: ts,
            }
        }

        promises.push(putMessage(message));
        await delay(postDelay);
    }

   await Promise.all(promises);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}