import { createLogger } from 'winston';
import * as chai from 'chai';

import { DBSettings } from '../src/model';

import { CouchDBClient } from './../src/CouchdbClient';

describe('test migration API endpoint - trivial tests', () => {

  it('test', async () => {

    // TODO set up local Cloudant Docker Image
    const logger = createLogger();
    const settings: DBSettings = {
      dbURL: 'localhost',
      dbName: 'test',
      designDoc: {},
      dbHost: process.env.DBHOST,
      dbPassword: process.env.DBPASSWORD,
      dbUsername: process.env.DBUSERNAME,
    };
    const dbClient = new CouchDBClient(settings, logger);

    chai.assert.isNotNull(dbClient);
  });
});
