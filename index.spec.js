const supertest = require('supertest');
const sinon = require('sinon');
const chai = require('chai');
const sinonChai = require('sinon-chai');
chai.use(sinonChai);
const expect = chai.expect;
const { Pool } = require('pg');
const rp = require('request-promise-native');

const app = require('./index.js');
const request = supertest(app);

const conn = require('./config/config');
const Data = require('./src/data.js');
const pool = new Pool({
  connectionString: conn.connectionString,
});

after(async () => {
  // cleanups
  const getQuery = {
    text: `
      DELETE FROM trees WHERE true;
      DELETE FROM devices WHERE true;
      DELETE FROM planter_registrations WHERE true;
      DELETE FROM planter WHERE true;
    `,
  };
  await pool.query(getQuery).catch((err) => {
    console.log(`Database cleanup after running tests failed`);
    throw err;
  });
});

describe('API', () => {
  describe('Planters Endpoints', () => {
    describe('planter registrations', () => {
      let dataStub, data2Stub;

      beforeEach(() => {
        dataStub = sinon
          .stub(Data.prototype, 'findOrCreateUser')
          .resolves({ id: 1, phone: 'phone' });
        data2Stub = sinon
          .stub(Data.prototype, 'createPlanterRegistration')
          .resolves();
      });

      afterEach(() => {
        dataStub.restore();
        data2Stub.restore();
      });
      it('should register a planter at /planter', async () => {
        const v1PlanterObject = {
          planter_identifier: 'planter_identifier',
          first_name: 'first_name',
          last_name: 'last_name',
          organization: 'organization',
          device_identifier: 'device_identifier',
          record_uuid: 'record_uuid',
          image_url: 'image_url',
          lat: 'lat',
          lon: 'lon',
        };

        await request.post('/planter').send(v1PlanterObject).expect(200);

        const {
          planter_identifier,
          first_name,
          last_name,
          organization,
          device_identifier,
        } = v1PlanterObject;
        expect(dataStub).calledWith(
          planter_identifier,
          first_name,
          last_name,
          organization,
        );
        expect(data2Stub).calledWith(1, device_identifier, {
          ...v1PlanterObject,
          phone: 'phone',
          email: undefined,
        });
      });

      it('should register a planter at /v2/wallet_registrations', async () => {
        const v2PlanterObject = {
          wallet: 'wallet',
          first_name: 'first_name',
          last_name: 'last_name',
          phone: 'phone',
          email: 'email',
          lat: 'lat',
          lon: 'lon',
          user_photo_url: 'user_photo_url',
          registered_at: 'registered_at',
        };
        await request
          .post('/v2/wallet_registrations')
          .send(v2PlanterObject)
          .expect(200);

        const { wallet, first_name, last_name, lat, lon } = v2PlanterObject;

        expect(dataStub).calledWith(wallet, first_name, last_name, null);
        expect(data2Stub).calledWith(1, null, {
          planter_identifier: wallet,
          first_name,
          last_name,
          organization: null,
          device_identifier: null,
          lat,
          lon,
          phone: 'phone',
          email: undefined,
        });
      });
    });
  });

  describe('Devices Endpoints', () => {
    describe('PUT /devices/', () => {
      let dataStub;

      beforeEach(() => {
        dataStub = sinon
          .stub(Data.prototype, 'upsertDevice')
          .resolves({ status: 'Device upserted' });
      });

      afterEach(() => {
        dataStub.restore();
      });

      it('should add device to the list of devices at /devices', async () => {
        const deviceObject = {
          device_identifier: 'device_identifier',
          app_version: 'app_version',
          app_build: 'app_build',
          manufacturer: 'manufacturer',
          brand: 'brand',
          model: 'model',
          hardware: 'hardware',
          device: 'device',
          serial: 'serial',
          androidRelease: 'androidRelease',
          androidSdkVersion: 'androidSdkVersion',
        };

        const response = await request
          .put('/device')
          .send(deviceObject)
          .expect(200);

        expect(response.body).eql({ device: { status: 'Device upserted' } });
        expect(dataStub).calledWith(deviceObject);
      });

      it('should add device to the list of devices at /v2/device_configurations', async () => {
        const deviceObject = {
          device_identifier: 'device_identifier',
          brand: 'brand',
          model: 'model',
          device: 'device',
          serial: 'serial',
          hardware: 'hardware',
          manufacturer: 'manufacturer',
          app_build: 'app_build',
          app_version: 'app_version',
          os_version: 'os_version',
          sdk_version: 'sdk_version',
          logged_at: 'logged_at',
        };
        const response = await request
          .post('/v2/device_configurations')
          .send(deviceObject)
          .expect(200);

        expect(response.body).eql({ device: { status: 'Device upserted' } });
        const { os_version, sdk_version } = deviceObject;
        delete deviceObject.os_version;
        delete deviceObject.sdk_version;
        delete deviceObject.logged_at;
        expect(dataStub).calledWith({
          ...deviceObject,
          androidRelease: os_version,
          androidSdkVersion: sdk_version,
        });
      });
    });
  });

  describe('Trees Endpoints', () => {
    describe('POST /tree', () => {
      let findUserStub,
        checkForExistingTreeStub,
        createTreeStub,
        rpStub,
        useFieldDataServiceStub;

      beforeEach(() => {
        findUserStub = sinon.stub(Data.prototype, 'findUser');
        checkForExistingTreeStub = sinon.stub(
          Data.prototype,
          'checkForExistingTree',
        );
        createTreeStub = sinon.stub(Data.prototype, 'createTree');
        rpStub = sinon.stub(rp, 'post');
        useFieldDataServiceStub = sinon.stub(conn, 'useFieldDataService');
      });

      afterEach(() => {
        findUserStub.restore();
        checkForExistingTreeStub.restore();
        createTreeStub.restore();
        rpStub.restore();
        useFieldDataServiceStub.restore();
      });

      const treeObject = {
        uuid: 'uuid',
        image_url: 'image_url',
        lat: 'lat',
        lon: 'lon',
        gps_accuracy: 'gps_accuracy',
        note: 'note',
        device_identifier: 'device_identifier',
        planter_identifier: 'planter_identifier',
        timestamp: 1644620400000,
        attributes: [],
      };

      const v2TreeObject = {
        id: 'id',
        session_id: 'session_id',
        image_url: 'image_url',
        lat: 'lat',
        lon: 'lon',
        gps_accuracy: 'gps_accuracy',
        note: 'note',
        abs_step_count: 'abs_step_count',
        delta_step_count: 'delta_step_count',
        rotation_matrix: 'rotation_matrix',
        extra_attributes: 'extra_attributes',
        captured_at: '2022-02-12T22:45:36.005Z',
      };

      it('should error out -- planter identifier not found', async () => {
        const response = await request
          .post('/tree')
          .send(treeObject)
          .set('Accept', 'application/json')
          .expect(404);
        expect(findUserStub).calledWith('planter_identifier');
        expect(checkForExistingTreeStub).not.called;
        expect(createTreeStub).not.called;
        expect(response.body).eql({
          error: `planter not found planter_identifier`,
        });
      });

      it('duplicates exist return 200', async () => {
        findUserStub.resolves({ user: 'found' });
        checkForExistingTreeStub.resolves({ tree: 'found' });
        const response = await request
          .post('/tree')
          .send(treeObject)
          .set('Accept', 'application/json')
          .expect(200);
        expect(response.body).eql({
          duplicate: { tree: 'found' },
        });
        expect(findUserStub).calledWith('planter_identifier');
        expect(checkForExistingTreeStub).calledWith('uuid');
        expect(createTreeStub).not.called;
      });

      it('create a legacy tree -- useFieldDataService env variable is not true', async () => {
        findUserStub.resolves({ id: 'found' });
        createTreeStub.resolves({ tree: 'created' });
        checkForExistingTreeStub.resolves(null);
        useFieldDataServiceStub.get(() => 'false');
        const response = await request
          .post('/tree')
          .send(treeObject)
          .set('Accept', 'application/json')
          .expect(201);
        expect(response.body).eql({
          tree: { tree: 'created' },
        });
        expect(findUserStub).calledWith('planter_identifier');
        expect(rpStub).not.called;
        expect(checkForExistingTreeStub).calledWith('uuid');
        expect(createTreeStub).calledWith(
          'found',
          'device_identifier',
          treeObject,
        );
      });

      it('make a call to the field_data api', async () => {
        findUserStub.resolves({ id: 'found' });
        rpStub.resolves({ capture: 'created' });
        checkForExistingTreeStub.resolves(null);
        useFieldDataServiceStub.get(() => 'true');
        const response = await request
          .post('/tree')
          .send({ ...treeObject })
          .set('Accept', 'application/json')
          .expect(201);
        expect(response.body).eql({
          fieldCapture: { capture: 'created' },
        });
        expect(findUserStub).calledWith('planter_identifier');
        expect(rpStub).calledOnce;
        expect(checkForExistingTreeStub).calledWith('uuid');
        expect(createTreeStub).not.called;
      });

      it('make a call to the field_data api -- v2Captures', async () => {
        findUserStub.resolves({ id: 'found' });
        rpStub.resolves({ capture: 'created' });
        checkForExistingTreeStub.resolves(null);
        useFieldDataServiceStub.get(() => 'true');
        const response = await request
          .post('/v2/captures')
          .send(v2TreeObject)
          .set('Accept', 'application/json')
          .expect(201);
        expect(findUserStub).not.called;
        expect(checkForExistingTreeStub).calledWith('id');
        expect(createTreeStub).not.called;
        expect(response.body).eql({
          fieldCapture: { capture: 'created' },
        });
      });
    });
  });
});
