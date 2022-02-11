require('dotenv').config();
const express = require('express');
require('express-async-errors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const { version } = require('./package.json');
const Data = require('./src/data');
const { processPlanter, processDevice, processCapture } = require('./helper');

const config = require('./config/config');

const pool = new Pool({
  connectionString: config.connectionString,
});

pool.on('connect', (client) => {
  console.log(`connected ${client}`);
});

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const data = new Data(pool);

const app = express();
const port = process.env.NODE_PORT || 3005;

app.use(bodyParser.urlencoded({ extended: false })); // parse application/x-www-form-urlencoded
app.use(bodyParser.json()); // parse application/json

// Optional fallthrough error handler
app.use((err, req, res, next) => {
  // The error id is attached to `res.sentry` to be returned
  // and optionally displayed to the user for support.
  res.status(500).send(`Error occurred ${err}`);
  next();
});

app.set('view engine', 'html');

app.post('/planter', async (req, res) => {
  await processPlanter(req.body, res, data);
});

app.post('/tree', async (req, res) => {
  await processCapture({ ...req.body, version: 1 }, res, data);
});

app.put('/device', async (req, res) => {
  await processDevice(req.body, res, data);
});

app.post('/v2/wallet_registrations', async (req, res) => {
  const {
    wallet,
    first_name,
    last_name,
    phone,
    email,
    lat,
    lon,
    user_photo_url,
    registered_at,
  } = req.body;

  await processPlanter(
    {
      planter_identifier: wallet,
      first_name,
      last_name,
      phone,
      email,
      organization: null,
      device_identifier: null,
      lat,
      lon,
    },
    res,
    data,
  );
});

app.post('/v2/device_configurations', async (req, res) => {
  const {
    device_identifier,
    brand,
    model,
    device,
    serial,
    hardware,
    manufacturer,
    app_build,
    app_version,
    os_version,
    sdk_version,
    logged_at,
  } = req.body;

  await processDevice(
    {
      device_identifier,
      app_version,
      app_build,
      manufacturer,
      brand,
      model,
      hardware,
      device,
      serial,
      androidRelease: os_version,
      androidSdkVersion: sdk_version,
    },
    res,
    data,
  );
});

app.post('/v2/captures', async (req, res) => {
  const {
    id,
    session_id,
    image_url,
    lat,
    lon,
    gps_accuracy,
    note,
    abs_step_count,
    delta_step_count,
    rotation_matrix,
    extra_attributes,
    capture_taken_at,
  } = req.body;

  await processCapture(
    {
      uuid: id,
      image_url,
      lat,
      lon,
      gps_accuracy,
      note,
      session_id,
      attributes: [
        { key: 'abs_step_count', value: abs_step_count },
        { key: 'delta_step_count', value: delta_step_count },
        { key: 'rotation_matrix', value: rotation_matrix },
        ...extra_attributes,
      ],
      timestamp: Math.floor(new Date(capture_taken_at).getTime() / 1000),
      version: 2,
    },
    res,
    data,
  );
});

app.get('*', async (req, res) => {
  res.status(200).send(version);
});

app.use((err, req, res, next) => {
  res.status(500);
  res.json({ error: err.message });
  next(err);
});

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});

module.exports = app;
