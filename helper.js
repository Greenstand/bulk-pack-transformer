const rp = require('request-promise-native');
const convertStringToUuid = require('uuid-by-string');
const config = require('./config/config');

const processPlanter = async (planterObject, res, data) => {
  const planter = await data.findOrCreateUser(
    planterObject.planter_identifier,
    planterObject.first_name,
    planterObject.last_name,
    planterObject.organization,
  );
  const body = { ...planterObject };
  body.phone = planter.phone;
  body.email = planter.email;
  await data.createPlanterRegistration(
    planter.id,
    planterObject.device_identifier,
    body,
  );
  console.log(`processed planter ${planter.id}`);
  res.status(200).json({});
};

const processDevice = async (deviceObject, res, data) => {
 // console.log('/device');
  const device = await data.upsertDevice(deviceObject);
 // console.log('upserted');
  res.status(200).json({ device });
  console.log('/device done');
};

const processCapture = async (captureObject, res, data) => {
  console.log('/capture');
  const { version, planter_identifier, device_identifier, session_id } =
    captureObject;
  delete captureObject.version;

  let user;
  if (version === 1) {
    user = await data.findUser(planter_identifier);
    if (user == null) {
      res.status(404).json({
        error: `planter not found ${planter_identifier}`,
      });
      return;
    }
  }
  console.log('check for existing');
  let duplicate = null;
  if (
    captureObject.uuid !== null &&
    captureObject.uuid !== undefined &&
    captureObject.uuid !== ''
  ) {
    duplicate = await data.checkForExistingTree(captureObject.uuid);
  }
  if (duplicate !== null) {
    console.log('existing');
    res.status(200).json({ duplicate });
  } else if (config.useFieldDataService === 'true') {
    console.log('prepare to use field data service');
    // translate to field-data capture payload
    const tree = { ...captureObject };
    const {attributes} = tree;

    const absStepCountIndex = attributes.findIndex(
      (a) => a.key === 'abs_step_count',
    );
    const absStepCountArray = attributes.splice(absStepCountIndex, 1);
    const [abs_step_count] = absStepCountArray;

    const deltaStepCountIndex = attributes.findIndex(
      (a) => a.key === 'delta_step_count',
    );
    const deltaStepCountArray = attributes.splice(deltaStepCountIndex, 1);
    const [delta_step_count] = deltaStepCountArray;

    const rotationMatrixIndex = attributes.findIndex(
      (a) => a.key === 'rotation_matrix',
    );
    const rotationMatrixArray = attributes.splice(rotationMatrixIndex, 1);
    const [rotation_matrix] = rotationMatrixArray;

    const capture = {
      id: tree.uuid,
      image_url: tree.image_url,
      session_id:
        session_id ||
        convertStringToUuid(device_identifier + planter_identifier),
      lat: tree.lat,
      lon: tree.lon,
      gps_accuracy: tree.gps_accuracy,
      abs_step_count: abs_step_count?.value,
      delta_step_count: delta_step_count?.value,
      rotation_matrix: rotation_matrix?.value,
      note: tree.note,
      extra_attributes: attributes,
      captured_at: new Date(tree.timestamp * 1000).toISOString(),
    };
    const options = {
      body: capture,
      json: true, // Automatically stringifies the body to JSON
    };
    console.log("contacting field data service");
    console.log(capture);
    const fieldCapture = await rp.post(
      `${config.fieldDataURL}raw-captures`,
      options,
    );
    res.status(201).json({ fieldCapture });
  } else {
    console.log("Storing tree");
    const tree = await data.createTree(
      user.id,
      device_identifier,
      captureObject,
    );
    console.log(`created tree ${tree.uuid}`);
    res.status(201).json({ tree });
  }
};

module.exports = {
  processPlanter,
  processDevice,
  processCapture,
};
