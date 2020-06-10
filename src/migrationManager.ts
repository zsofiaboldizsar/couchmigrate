import { DBSettings } from 'model/settings';
var async = require('async');
import { dbClient } from './db-util/create-db-client';
/* var nano:any;
var db:any; */

export const doMigrationAsync = async (err:any, dbName:string, data:any) => {
  if(err) {
    logger.log("Cannot find file", dd_filename);
    rootCallBack(err,data);
  }
  
  // this is the whole design document
  var dd:any;
  try {
    dd = JSON.parse(data);
  } catch(e) {
    logger.log('error',"FAILED to parse file contents as JSON - cannot continue");
    rootCallBack(e,null);
  }

  var dd_name = dd._id;
  delete dd._rev;
  var hasViews = true;
  var dd_old_name = dd_name + "_OLD";
  var dd_new_name = dd_name + "_NEW";
  
  
  async.series( [
    // check that the database exists
    function(callback:Function) {
      logger.log('log',"## check db exists");
      // if it doesn't we'll get an 'err' and the async process will stop
      nano.db.get(dbName, function(err:string, data:any) {
        debug(err,data);
        callback(err,data);
      });
    },

    // check that the existing view isn't the same as the incoming view
    function(callback:Function) {
      db.get(dd_name, function(err:string, data:any) {
        if(err) {
          return callback(null, null);
        }
        var a = clone(data);
        var b = clone(dd);
        delete a._rev;
        delete a._id;
        delete b._rev;
        delete b._id;
        if(JSON.stringify(a) === JSON.stringify(b)) {
          logger.log('log',"** The design document is the same, no need to migrate! **");
          callback(true,{reason:`** The design document is the same, no need to migrate! **`});
        } else {
          callback(null,null);
        }
      });
    },
       
    // copy original design document to _OLD
    function(callback:Function) {
      logger.log('log',"## copy original design document to _OLD");
      copydoc(dd_name, dd_old_name, function(err:string, data:any) {
        callback(null, null);
      });
    },
    
    // write new design document to _NEW
    function(callback:Function) {
      logger.log('log',"## write new design document to _NEW");
      writedoc(dd, dd_new_name, callback);
    },

    // trigger a new index.build
    function(callback:Function) {
      var name = dd._id.replace(/_design\//, "");
      var v:any;
      var isSearch = false;
      if (dd.views) {
        v = Object.keys(dd.views)[0];
      } else if (dd.indexes) {
        isSearch = true;
        v = Object.keys(dd.indexes)[0];
      } else {
        logger.log('log',"## Design document has no views, no deed to trigger view build")
        hasViews = false;
        return callback(null, null);
      }

      logger.log('log',"## trigger a new '" + (isSearch ? 'search' : 'view') + "' index.build after 3 sec for", name, "/", v);

      // wait 3 seconds before querying the view
      setTimeout(function() {
        if (isSearch) {
          db.search(name, v, { q: "xyz" }, function(err:string, data:any) {
            debug(err, data);
            // on a long view-build this request will timeout and return an 'err', which we can ignore
            callback(null, null);
          });
        } else {
          db.view(name, v, { limit: 1 }, function(err:string, data:any) {
            debug(err, data);
            // on a long view-build this request will timeout and return an 'err', which we can ignore
            callback(null, null);
          });
        }
      }, 3000);
    },

    // wait for the view build to complete, by polling _active_tasks
    function(callback:Function) {
      // If design document has no views, no deed to wait for the view to be built
      if(!hasViews){
        return callback(null, null)
      }

      logger.log('log',"## wait 10 sec for the view build to complete, by polling _active_tasks");
      var changes_done = 0;
      var total_changes = 0;
      var numTasks = 1;
      async.doWhilst(
      function(callback:Function) {
        setTimeout(function() {
          nano.request({ path: "_active_tasks" }, function(err:string, data:any) {
            debug(err, data);
            logger.log('log','rebuilding ' + dbName + ' - ' + dd_name + ', indexes left: ' + (total_changes - changes_done));
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
        function(err:string) {
            callback(null, null)
        }
      );
    },

    // copy _NEW to live
    function(callback:Function) {
      logger.log('log',"## copy _NEW to live", dd_new_name, dd_name);
      copydoc(dd_new_name, dd_name, function(err:string, data:any) {
        debug(err,data);
        callback(err,data);
      });
    },
    
    // delete the _OLD view
    function(callback:Function) {
      logger.log('log',"## delete the _OLD view", dd_old_name);
      deletedoc(dd_old_name, callback);
    },
    
    // delete the _NEW view
    function(callback:Function) {
      logger.log('log',"## delete the _NEW view", dd_new_name);
      deletedoc(dd_new_name, callback);
    }
    
  ], function(err:string, data:any) {
    if (err) {
      logger.log('log',err);
    }
    logger.log('log',"finished!!!");
    rootCallBack && rootCallBack(err, data);

  });

};

/* export function doMigrate(dbSettings:DBSettings, rootCallBack: Function){
    if (dbSettings.dbURL)
      nano = createDBClient(dbSettings.dbURL,dbSettings.dbName);
    else
      nano = createDBClient(`https://${dbSettings.dbUsername}:${dbSettings.dbPassword}@${dbSettings.dbUsername}.${dbSettings.dbHost}`,dbSettings.dbName);
    
    db = nano.db.use(dbSettings.dbName);
    migrate(null, dbSettings.dbName, JSON.stringify(dbSettings.designDoc), rootCallBack);
  } */
  export const doMigrate = async (dbSettings:DBSettings) => {
    const nano = (dbSettings.dbURL) 
      ? dbClient(dbSettings.dbURL,dbSettings.dbName)
      : dbClient(`https://${dbSettings.dbUsername}:${dbSettings.dbPassword}@${dbSettings.dbUsername}.${dbSettings.dbHost}`,dbSettings.dbName);
    
    const db = nano.db.use(dbSettings.dbName);
    await doMigrationAsync(null, dbSettings.dbName, JSON.stringify(dbSettings.designDoc));
  }


 /* export async function doMigrateAsync(dbSettings:DBSettings):Promise<any>{
    return new Promise(function(resolve,reject){
      doMigrate(dbSettings,function(err:string,data:any){
             if(err !== null) return reject(err);
             resolve(data);
         });
    });
} */
export const doMigrateAsync = async (dbSettings:DBSettings):Promise<any> => {
  try {
    await doMigrate(dbSettings);
  } catch(error) {
    throw new Error(error);
  }
};


/* export const doDelete = async (dbSettings:DBSettings, rootCallBack:Function) => {
    nano = createDBClient(`https://${dbSettings.dbUsername}:${dbSettings.dbPassword}@${dbSettings.dbUsername}.${dbSettings.dbHost}`,dbSettings.dbName);
    db = nano.db.use(dbSettings.dbName);
  deletedoc(dbSettings.designDoc._id, rootCallBack);
} */
export const doDelete = async (dbSettings:DBSettings) => {
  const nano = createDBClient(`https://${dbSettings.dbUsername}:${dbSettings.dbPassword}@${dbSettings.dbUsername}.${dbSettings.dbHost}`,dbSettings.dbName);
  const db = nano.db.use(dbSettings.dbName);

  await deletedoc(dbSettings.designDoc._id);
};


/* export async function doDeleteAsync(dbSettings:DBSettings):Promise<any>{
  return new Promise(function(resolve,reject){
    doDelete(dbSettings,function(err:string,data:any){
           if(err !== null) return reject(err);
           resolve(data);
       });
  });
} */
export const doDeleteAsync = async (dbSettings:DBSettings):Promise<any> => {
  try {
    await doDelete(dbSettings);
  } catch(error) {
    throw new Error(error.message);
  }
};