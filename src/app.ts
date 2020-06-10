import * as fs from 'fs';
import * as Nano from 'nano'
import * as path from 'path';
import * as Argv from 'yargs';

import { doMigrate } from './migrationManager';
import { DBSettings } from './model/settings';

const argv: any = Argv
   .usage("CouchDB design document migration")
   .usage('Usage: $0 --dd <design document filename> --db <name of database>')
   .demand(['dd','db'])
   .argv;


// get COUCH_URL from the environment
let COUCH_URL = null;
if (typeof process.env.COUCH_URL === 'undefined') {
  console.log("Please use environment variable COUCH_URL to indicate URL of your CouchDB/Cloudant");
  console.log("  e.g. export COUCH_URL=https://_username_:_password_@127.0.0.1:5984");
  process.exit(1);
} else {
  COUCH_URL = process.env.COUCH_URL;
}
const nano = Nano( {
  url: COUCH_URL,
  requestDefaults: {
    timeout: 10000,
    headers: {
      'User-Agent': 'couchmigrate',
      'x-cloudant-io-priority': 'low'
    }
  }
});
const db = nano.db.use(argv.db);

export const rootCallBack = (data:any) => {
  console.log("rootCallback invoked.");
}

export const setUpAndCallMigration = async (data:any) => {
  const settings: DBSettings = {
    dbURL:process.env.COUCH_URL,
    dbName:argv.db,
    designDoc:JSON.parse(data),
    dbHost: process.env.DBHOST,
    dbPassword: process.env.DBPASSWORD,
    dbUsername: process.env.DBUSERNAME,
  };

  console.log("setUpAndCallMigration called");
  console.dir(data);
  await doMigrate(settings);
}

// load the design document

const dd_filename = argv.dd;
if (/\.js$/.test(dd_filename)) {
  // use require to load js design doc
  const dataAbs = path.join(process.cwd(), dd_filename.replace(/([^.]+)\.js$/, '$1'));
  setUpAndCallMigration(JSON.stringify(require(dataAbs)));
    
} else {
  // read json
  const data = fs.readFileSync(dd_filename, 'utf8');
  setUpAndCallMigration(data);
}
