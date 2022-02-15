const Data = require('./data');
const { Pool } = require('pg');
const conn = require('./../config/config');
const pool = new Pool({
  connectionString: conn.connectionString,
});
const data = new Data(pool);

const expect = require('chai').expect;
const uuid = require('uuid');

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

describe('The data functions', function () {
  it('creates a user', async () => {
    const createdUser = await data.findOrCreateUser(
      085739203636,
      'Test',
      'Test2',
      'Test3',
    );
    expect(createdUser).to.not.be.null;

    const existingUser = await data.findUser(085739203636);
    expect(existingUser).to.not.be.null;
  });

  it('creates a planter registration', async () => {
    const reg = await data.createPlanterRegistration(1, 11, {
      first_name: 'Test',
      last_name: 'User',
      organization: 'My Organization',
      planter_identifier: '123123123',
      lon: 12,
      lat: 12,
    });
    expect(reg).to.not.be.null;
  });

  it('creates a tree', async () => {
    const treeUUID = uuid();
    const tree = await data.createTree(1, 1, {
      lat: 80,
      lon: 120,
      gps_accuracy: 1,
      note: 'my note',
      timestamp: 1536367800,
      image_url: 'http://www.myimage.org/',
      sequence_id: 1,
      uuid: treeUUID,
    });
    expect(tree).to.not.be.null;

    const trees = await data.trees();
    expect(trees.length).to.equal(1);

    it('finds trees for a user', async () => {
      const trees = await data.treesForUser(1);
      expect(trees.length).to.equal(1);
    });
  });

  it('detects a duplicate tree', async () => {
    const treeUUID = uuid();
    const tree = await data.createTree(1, 1, {
      lat: 80,
      lon: 120,
      gps_accuracy: 1,
      note: 'my note',
      timestamp: 1536367800,
      image_url: 'http://www.myimage.org/',
      sequence_id: 1,
      uuid: treeUUID,
    });
    const duplicate = await data.checkForExistingTree(treeUUID);
    expect(duplicate).to.not.be.null;
  });

  it('detects a non-duplicate tree', async () => {
    const treeUUID = uuid();
    const duplicate = await data.checkForExistingTree(treeUUID);
    expect(duplicate).to.be.null;
  });

  it('inserts attributes', async () => {
    const attributes = await data.insertTreeAttributes(1, [
      {
        key: 'color',
        value: 'red',
      },
      {
        key: 'deviceid',
        value: 'test',
      },
    ]);
    expect(attributes).to.not.be.null;
    expect(attributes.length).to.equal(2);
    expect(attributes[1].key).to.equal('deviceid');
    expect(attributes[1].value).to.equal('test');
  });

  it('creates a tree with attributes', async () => {
    const tree = await data.createTree(1, 1, {
      lat: 80,
      lon: 120,
      gps_accuracy: 1,
      note: 'my note',
      timestamp: 1536367800,
      image_url: 'http://www.myimage.org/',
      sequence_id: 1,
      attributes: [
        {
          key: 'color',
          value: 'red',
        },
        {
          key: 'deviceid',
          value: 'test',
        },
      ],
    });
    expect(tree).to.not.be.null;
    expect(tree.attributes.length).to.equal(2);
    expect(tree.attributes[1].id).is.not.null;
    expect(tree.attributes[1].key).to.equal('deviceid');
    expect(tree.attributes[1].value).to.equal('test');
  });

  it('creates a device', async () => {
    const dev = await data.upsertDevice({
      app_version: '1',
      app_build: 1,
      manufacturer: 'manufacturer',
      brand: 'brand',
      model: 'model',
      hardware: 'hardware',
      device: 'device',
      serial: 'serial',
    });
    expect(dev).to.not.be.null;
  });
});
