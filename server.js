// server.js
const Bugsnag = require('@bugsnag/js'),
  BugsnagPluginExpress = require('@bugsnag/plugin-express');
const compression = require('compression');
const express = require('express');
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");

const router = require("./routes/base_route");

const bugsnagStage = process.env.bugsnag_stage || "no-stage-declared";

Bugsnag.start({
  apiKey: process.env.BUGSNAG_API_KEY || "skjdbfo2843890hdf923ejneskdnkma2",
  sendCode: true,
  releaseStage: bugsnagStage,
  setReleaseStage: bugsnagStage,
  beforeSend: (report) => {
    //Not sending sensitive info
    delete report.request.headers["authorization"];
    delete report.request.headers["x-apigateway-event"];
    delete report.request.headers["x-apigateway-context"];

    //Handled error in the 400 usually
    if (!!report.originalError.statusCode)
      report.ignore();
  },
  plugins: [BugsnagPluginExpress]
})

const { requestHandler, errorHandler } = Bugsnag.getPlugin('express');
app.use(requestHandler);

app.use(bodyParser.urlencoded({ limit: "50mb", extende: true }));
app.use(bodyParser.json({ limit: "50mb" }));

app.use((req,res, next) => {
  res.locals.serviceName = "geocoder";
  next();
})

app.options("*", cors());
app.use(cors());

app.use("/service", router);

const shouldCompress = (req, res) => {
  if (req.headers['x-no-compression']) {
    return false;
  }
  return compression.filter(req, res);
};

const MAX_SIZE_PAYLOAD = 1024 * 10;
app.use(compression({
  filter: shouldCompress,
  threshold: MAX_SIZE_PAYLOAD,
  level: 6,
}));

app.get('/', (req, res) => {
  const animal = 'elephant';
  res.send(animal.repeat(1000));
});

app.use(errorHandler);

// app.listen(3000, function () {
//   console.log('Example app listening on port 3000!');
// });

//TODO convert server.js into a rest lambda resource
module.exports = app;