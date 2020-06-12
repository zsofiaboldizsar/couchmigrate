import * as fs from 'fs';
import * as path from 'path';
import * as Argv from 'yargs';
import { DesignDocUpdater } from 'DesignDocUpdater';

import { DBSettings } from './model/settings';

export const setUpAndCallMigration = async (dbName: string, docName: string, data: any): Promise<void> => {
  const settings: DBSettings = {
    dbURL: process.env.COUCH_URL,
    dbName,
    designDoc: JSON.parse(data),
    dbHost: process.env.DBHOST,
    dbPassword: process.env.DBPASSWORD,
    dbUsername: process.env.DBUSERNAME,
  };
  const ddUpdater = new DesignDocUpdater(settings);

  return ddUpdater.updateDesignDocument(docName, data);
};

(async () => {

  const argv: any = Argv
  .usage('CouchDB design document migration')
  .usage('Usage: $0 --dd <design document filename> --db <name of database>')
  .demand(['dd', 'db'])
  .argv;

  // get COUCH_URL from the environment
  let COUCH_URL = null;
  if (typeof process.env.COUCH_URL === 'undefined') {
  // tslint:disable-next-line: no-console
  console.log('Please use environment variable COUCH_URL to indicate URL of your CouchDB/Cloudant');
  // tslint:disable-next-line: no-console
  console.log('  e.g. export COUCH_URL=https://_username_:_password_@127.0.0.1:5984');
  process.exit(1);
  } else COUCH_URL = process.env.COUCH_URL;

  // load the design document

  const ddFileName = argv.dd;
  const dataAbs = (/\.js$/.test(ddFileName)) ?
    path.join(process.cwd(), ddFileName.replace(/([^.]+)\.js$/, '$1')) :
    ddFileName;

  const data = fs.readFileSync(dataAbs, 'utf8');

  return setUpAndCallMigration(argv.db, ddFileName, data);

})().catch(e => {
  // Deal with the fact the chain failed
});
