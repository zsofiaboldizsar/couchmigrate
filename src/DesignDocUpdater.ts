
import { createLogger, Logger } from 'winston';
import { default as delay } from 'delay';

import { DBSettings } from './model';
import { CouchDBClient } from './CouchdbClient';
import * as utils from './utils';

export class DesignDocUpdater {

    dbClient: any;
    logger: Logger;

    constructor(dbSettings: DBSettings) {
      this.logger = createLogger();
      this.dbClient = new CouchDBClient(dbSettings, this.logger);
    }

    async updateDesignDocument(docName: string, docContent: any): Promise<void> {

      /* steps:
        1.: Check DB exists (is this still needed?)
        2. fetch document from DB
        2. compare document with that local
        3. copy to previous document to _OLD
        4. copy new document as _NEW
        5. trigger index building
        6. iteratively check index
        7. copy new to live
        8. delete _old
        9 delete _new
      */

      const storedDoc = await this.dbClient.fetchDocument(docName);
      if (utils.areDocumentsEquals(storedDoc, docContent)) {
        this.logger.log('log', '** The design document is the same, no need to migrate! **');

        return Promise.resolve();
      }

      const bcpDesignDocName = `${docName}_OLD`;
      const newDesignDocName = `${docName}_NEW`;
      await this.dbClient.copyDocument(docName, bcpDesignDocName);
      const newDesignDoc = await this.dbClient.upsertDocument(docContent, newDesignDocName);

      // trigger index building
      const designDocName = newDesignDoc._id.replace(/_design\//, '');
      let v;
      await delay(3000);
      if (newDesignDoc.views) {
        v = Object.keys(newDesignDoc.views)[0];
        await this.dbClient.view(designDocName, v, { limit: 1 });
      } else if (newDesignDoc.indexes){
        v = Object.keys(newDesignDoc.indexes)[0];
        await this.dbClient.search(designDocName, v, {q: 'xyz'})
      } else {
        this.logger.log('log', '** Design document has no views, no need to trigger view build **');

        return Promise.resolve();
      }
      
      // iteratively check the index by send query/search requests
      let numTasks = 1;
      let changes_done = 0;
      let total_changes = 0;
      do {
        await delay(10000);
        const tasks = await this.dbClient.request({path: '_active_tasks'});
        numTasks = 0;
        for (const task in tasks) {
          //const database = tasks[task].database !== undefined ? tasks[task].database : undefined;
          // const databaseFromTask = database.substr(database.lastIndexOf("/") + 1, database.lastIndexOf(".") - database.lastIndexOf("/") - 1);
          if ((tasks[task].type === "indexer" || tasks[task].type === "search_indexer") &&
            tasks[task].design_document === newDesignDocName) {
            numTasks++;
            changes_done += tasks[task].changes_done;
            total_changes += tasks[task].total_changes;
          }
        }
      } while (numTasks > 0);
      
      await this.dbClient.copyDocument(newDesignDocName, docName);
      await this.dbClient.deleteDocument(newDesignDocName);

      this.logger.log('log', '** Finished design doc updating **');
      
      return this.dbClient.deleteDocument(bcpDesignDocName);
    }
  }

/*

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
                  var databaseFromTask =
                    database.substr(database.lastIndexOf("/") + 1, database.lastIndexOf(".") - database.lastIndexOf("/") - 1);
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
*/
