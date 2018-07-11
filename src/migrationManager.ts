var fs = require('fs'),
  async = require('async');

var nano;
var db;


function createDBClient(dbUrl,dbName){
    return require('nano')( {
     url: dbUrl,
     db: dbName,
     requestDefaults: {
       timeout: 10000,
       headers: {
         'User-Agent': 'couchmigrate',
         'x-cloudant-io-priority': 'low'
       }
     }
   });
   }
   

   var debug = function(err, data) {
    console.log("  err = ", (err)?"true":"");
    console.log("  data = ", JSON.stringify(data));
    console.log("-------------------------------");
  };
  
  var copydoc = function(from_id, to_id, cb) {
    var from_doc = null,
      to_doc = null;
    
    async.series([
      // fetch the document we are copying
      function(callback) {
        console.log("## copydoc - Fetching from", from_id);
        db.get(from_id, function(err, data) {
          debug(err, data);
          if (!err) {
            from_doc = data;
          }
          callback(err, data);
        });
      },
      
      // fetch the document we are copying to (if it is there)
      function(callback) {
        console.log("## copydoc - Fetching to", to_id);
        db.get(to_id, function(err, data) {
          debug(err, data);
          if (!err) {
            to_doc = data;
          }
          callback(null, data);
        });
      },
      
      // overwrite the destination
      function(callback) {
        console.log("## copydoc - Writing new to", to_id);
        from_doc._id = to_id;
        if (to_doc) {
          from_doc._rev = to_doc._rev;
        } else { 
          delete from_doc._rev;
        }
        console.log("## copydoc - contents",from_doc);
        db.insert(from_doc, function(err, data) {
          debug(err, data);
          callback(err, data);
        });
      }
    ], cb);
  };
  
  var writedoc = function(obj, docid, cb) {
    var preexistingdoc = null;
    async.series([
      function(callback) {
        console.log("## writedoc - Looking for pre-existing", docid);
        db.get(docid, function(err, data) {
          debug(err, data);
          if (!err) {
            preexistingdoc = data;
          }
          callback(null, data);
        });
      },
      function(callback) {
        obj._id = docid;
        if (preexistingdoc) {
          obj._rev = preexistingdoc._rev;
        }
        console.log("## writedoc - Writing doc", obj);
        db.insert(obj, function(err, data) {
          debug(err, data);
          callback(err, data);
        });
      }
    ], cb);
  };
  
  var deletedoc = function(docid, cb) {
  
    console.log("## deletedoc - Looking for docid", docid);
    db.get(docid, function(err, data) {
      debug(err, data);
      if (err) {
        return cb(null, null);
      }
      console.log("## deletedoc - Deleting ", docid, data._rev);
      db.destroy( docid, data._rev, function(err, d) {
        debug(err,d);
        cb(null, null);
      });
    });
  
  };
  
  var clone = function(x) {
    return JSON.parse(JSON.stringify(x));
  };
  
  var migrate = function(err, dbName, data, rootCallBack) {
    if(err) {
      console.log("Cannot find file", dd_filename);
      rootCallBack(err,data);
    }
    
    // this is the whole design document
    var dd;
    try {
      dd = JSON.parse(data);
    } catch(e) {
      console.log("FAILED to parse file contents as JSON - cannot continue");
      rootCallBack(e,null);
    }
  
    var dd_name = dd._id;
    delete dd._rev;
    var hasViews = true;
    var dd_old_name = dd_name + "_OLD";
    var dd_new_name = dd_name + "_NEW";
    
    async.series( [
      // check that the database exists
      function(callback) {
        console.log("## check db exists");
        // if it doesn't we'll get an 'err' and the async process will stop
        nano.db.get(dbName, function(err, data) {
          debug(err,data);
          callback(err,data);
        });
      },
  
      // check that the existing view isn't the same as the incoming view
      function(callback) {
        db.get(dd_name, function(err, data) {
          if(err) {
            console.log("!!!");
            return callback(null, null);
          }
          var a = clone(data);
          var b = clone(dd);
          delete a._rev;
          delete a._id;
          delete b._rev;
          delete b._id;
          if(JSON.stringify(a) === JSON.stringify(b)) {
            console.log("** The design document is the same, no need to migrate! **");
            callback(true,{reason:`** The design document is the same, no need to migrate! **`});
          } else {
            callback(null,null);
          }
        });
      },
         
      // copy original design document to _OLD
      function(callback) {
        console.log("## copy original design document to _OLD");
        copydoc(dd_name, dd_old_name, function(err,data) {
          callback(null, null);
        });
      },
      
      // write new design document to _NEW
      function(callback) {
        console.log("## write new design document to _NEW");
        writedoc(dd, dd_new_name, callback);
      },
  
      // trigger a new index.build
      function(callback) {
        var name = dd._id.replace(/_design\//, "");
        var v;
        var isSearch = false;
        if (dd.views) {
          v = Object.keys(dd.views)[0];
        } else if (dd.indexes) {
          isSearch = true;
          v = Object.keys(dd.indexes)[0];
        } else {
          console.log("## Design document has no views, no deed to trigger view build")
          hasViews = false;
          return callback(null, null);
        }
  
        console.log("## trigger a new '" + (isSearch ? 'search' : 'view') + "' index.build after 3 sec for", name, "/", v);
  
        // wait 3 seconds before querying the view
        setTimeout(function() {
          if (isSearch) {
            db.search(name, v, { q: "xyz" }, function(err, data) {
              debug(err, data);
              // on a long view-build this request will timeout and return an 'err', which we can ignore
              callback(null, null);
            });
          } else {
            db.view(name, v, { limit: 1 }, function(err, data) {
              debug(err, data);
              // on a long view-build this request will timeout and return an 'err', which we can ignore
              callback(null, null);
            });
          }
        }, 3000);
      },
  
      // wait for the view build to complete, by polling _active_tasks
      function(callback) {
        // If design document has no views, no deed to wait for the view to be built
        if(!hasViews){
          return callback(null, null)
        }
  
        console.log("## wait 10 sec for the view build to complete, by polling _active_tasks");
        var changes_done = 0;
        var total_changes = 0;
        var numTasks = 1;
        async.doWhilst(
        function(callback) {
          setTimeout(function() {
            nano.request({ path: "_active_tasks" }, function(err, data) {
              debug(err, data);
              console.log('rebuilding ' + dbName + ' - ' + dd_name + ', indexes left: ' + (total_changes - changes_done));
              changes_done = 0;
              total_changes = 0;
              numTasks = 0;
              for (var i in data) {
                var task = data[i];
                  var database = task.database != undefined ? task.database : "";
                  var databaseFromTask = database.substr(database.lastIndexOf("/") + 1, database.lastIndexOf(".") - database.lastIndexOf("/") - 1);
                  if ((task.type === "indexer" || task.type === "search_indexer") &&
                    databaseFromTask === dbName &&
                    task.design_document === dd_new_name) {
                    numTasks++;
                    changes_done += task.changes_done;
                    total_changes += task.total_changes;
                  }
              }
              callback(null, null);
            });
          // timeout increased as search_indexer tasks sometimes take longer before they appear in the task list
          }, 10000);
          },
          function() { return numTasks > 0 },
          function(err) {
              callback(null, null)
          }
        );
      },
  
      // copy _NEW to live
      function(callback) {
        console.log("## copy _NEW to live", dd_new_name, dd_name);
        copydoc(dd_new_name, dd_name, function(err, data) {
          debug(err,data);
          callback(err,data);
        });
      },
      
      // delete the _OLD view
      function(callback) {
        console.log("## delete the _OLD view", dd_old_name);
        deletedoc(dd_old_name, callback);
      },
      
      // delete the _NEW view
      function(callback) {
        console.log("## delete the _NEW view", dd_new_name);
        deletedoc(dd_new_name, callback);
      }
      
    ], function(err, data) {
      if (err) {
        console.log(err);
      }
      console.log("FINISHED!!!");
      rootCallBack && rootCallBack(err, data);

    });
  
  };

module.exports.doMigration = function(dbSettings, rootCallBack){
    if (dbSettings.dbURL)
      nano = createDBClient(dbSettings.dbURL,dbSettings.dbName);
    else
      nano = createDBClient(`https://${dbSettings.dbUsername}:${dbSettings.dbPassword}@${dbSettings.dbUsername}.${dbSettings.dbHost}`,dbSettings.dbName);
    
    db = nano.db.use(dbSettings.dbName);
    migrate(null, dbSettings.dbName, JSON.stringify(dbSettings.designDoc), rootCallBack);
  }

module.exports.doDelete = function(dbSettings, rootCallBack){
    nano = createDBClient(`https://${dbSettings.dbUsername}:${dbSettings.dbPassword}@${dbSettings.dbUsername}.${dbSettings.dbHost}`,dbSettings.dbName);
    db = nano.db.use(dbSettings.dbName);
  deletedoc(dbSettings.designDoc._id, rootCallBack);
}


