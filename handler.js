const awsServerlessExpress = require("aws-serverless-express");
const app = require("./server");
const server = awsServerlessExpress.createServer(app);

//TODO add secrets manager service with rotation

exports.hander = (event, context) => awsServerlessExpress.proxy(server, event, context);