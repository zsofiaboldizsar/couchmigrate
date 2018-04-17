var fs = require('fs'),
  async = require('async'),
  argv = require('yargs')
   .usage("CouchDB design document migration")
   .usage('Usage: $0 --dd <design document filename> --db <name of database>')
   .demand(['dd','db'])
   .argv;

var doMigration = require('./migrationManager').doMigration;
// get COUCH_URL from the environment
var COUCH_URL = null;
if (typeof process.env.COUCH_URL === 'undefined') {
  console.log("Please use environment variable COUCH_URL to indicate URL of your CouchDB/Cloudant");
  console.log("  e.g. export COUCH_URL=https://_username_:_password_@127.0.0.1:5984");
  process.exit(1);
} else {
  COUCH_URL = process.env.COUCH_URL;
}
var nano = require('nano')( {
  url: COUCH_URL,
  requestDefaults: {
    timeout: 10000,
    headers: {
      'User-Agent': 'couchmigrate',
      'x-cloudant-io-priority': 'low'
    }
  }
});
var db = nano.db.use(argv.db);

function rootCallBack(err,data){
  console.log("rootCallback invoked.");
}

function setUpAndCallMigration(err,data){
  settings = {
    dbURL:process.env.COUCH_URL,
    dbName:argv.db,
    designDoc:JSON.parse(data)
  }
  console.log("setUpAndCallMigration called");
  console.dir(data);
  doMigration(settings,rootCallBack);
}

// load the design document

var dd_filename = argv.dd;
if (/\.js$/.test(dd_filename)) {
  // use require to load js design doc
  var path = require('path'),
    dataAbs = path.join(process.cwd(), dd_filename.replace(/([^.]+)\.js$/, '$1'));

    setUpAndCallMigration(null,JSON.stringify(require(dataAbs)));
    
} else {
  // read json
  fs.readFile(dd_filename, {encoding: "utf8"}, setUpAndCallMigration);
}
