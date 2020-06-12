import * as Nano from 'nano'
import { createLogger, format, transports, Logger } from 'winston';
import { DBSettings } from 'model';

export class CouchDbClient {
    db: any;

    constructor(dbSettings: DBSettings) {
      const url = (dbSettings.dbURL) 
      ? dbClient(dbSettings.dbURL,dbSettings.dbName)
      : dbClient(`https://${dbSettings.dbUsername}:${dbSettings.dbPassword}@${dbSettings.dbUsername}.${dbSettings.dbHost}`,dbSettings.dbName);
      
        this.db = require('nano')({
            url,
            requestDefaults: {
              timeout: 10000,
              headers: {
                "User-Agent": "couchmigrate",
                "x-cloudant-io-priority": "low",
              },
            },
          });
    }
    /**
   * Copies a document in CouchDB
   *
   *
   * @param user
   * @param doc
   */
  async copydoc(from_id: string, to_id: string): Promise<any> {
    const fromDoc = this.db.get(from_id);
    let toDoc = this.db.get(to_id);
    
    fromDoc._id = toDoc._id;
    toDoc = toDoc ? fromDoc._rev = toDoc._rev : delete fromDoc._rev;

    this.db.insert(fromDoc);
    }
  }

export const dbClient = (dbUrl: string, dbName: string) => {
  return require("nano")({
    url: dbUrl,
    db: dbName,
    requestDefaults: {
      timeout: 10000,
      headers: {
        "User-Agent": "couchmigrate",
        "x-cloudant-io-priority": "low",
      },
    },
  });
};

const logger = createLogger();

var debug = function(err:string, data:string) {
  logger.log("  err = ", (err)?"true":"");
  logger.log("  data = ", JSON.stringify(data));
};

/*   var copydoc = function(from_id:string, to_id:string, cb:Function) {
    var from_doc:any = null,
      to_doc:any = null;
    
    async.series([
      // fetch the document we are copying
      function(callback:Function) {
        logger.log("## copydoc - Fetching from", from_id);
        db.get(from_id, function(err:string, data:any) {
          debug(err, data);
          if (!err) {
            from_doc = data;
          }
          callback(err, data);
        });
      },
      
      // fetch the document we are copying to (if it is there)
      function(callback:Function) {
        logger.log("## copydoc - Fetching to", to_id);
        db.get(to_id, function(err:string, data:any) {
          debug(err, data);
          if (!err) {
            to_doc = data;
          }
          callback(null, data);
        });
      },
      
      // overwrite the destination
      function(callback:Function) {
        logger.log("## copydoc - Writing new to", to_id);
        from_doc._id = to_id;
        if (to_doc) {
          from_doc._rev = to_doc._rev;
        } else { 
          delete from_doc._rev;
        }
        logger.log("## copydoc - contents",from_doc);
        db.insert(from_doc, function(err:string, data:any) {
          debug(err, data);
          callback(err, data);
        });
      }
    ], cb);
  }; */
  
  var writedoc = function(obj:any, docid:string, cb:Function) {
    var preexistingdoc:any = null;
    async.series([
      function(callback:Function) {
        logger.log("## writedoc - Looking for pre-existing", docid);
        db.get(docid, function(err:string, data:any) {
          debug(err, data);
          if (!err) {
            preexistingdoc = data;
          }
          callback(null, data);
        });
      },
      function(callback:Function) {
        obj._id = docid;
        if (preexistingdoc) {
          obj._rev = preexistingdoc._rev;
        }
        logger.log("## writedoc - Writing doc", obj);
        db.insert(obj, function(err:string, data:any) {
          debug(err, data);
          callback(err, data);
        });
      }
    ], cb);
  };
  
  /* var deletedoc = function(docid:string, cb:Function) {
  
    logger.log("## deletedoc - Looking for docid", docid);
    db.get(docid, function(err:string, data:any) {
      debug(err, data);
      if (err) {
        return cb(null, null);
      }
      logger.log("## deletedoc - Deleting ", docid, data._rev);
      db.destroy( docid, data._rev, function(err:string, d:any) {
        debug(err,d);
        cb(null, null);
      });
    });
  }; */
  export const deletedoc = async (docid:string): Promise<any> {
    try {
      logger.log("## deletedoc - Looking for docid", docid);
      const doc = await db.get(docid);

      logger.log("## deletedoc - Deleting ", docid, doc._rev);
      await db.destroy( docid, doc._rev);

      } catch(error) {
          throw new Error(error);
      }
    };
  
  /* var clone = function(x:any) {
    return JSON.parse(JSON.stringify(x));
  }; */
  export const clone = (x:any): string => {
    return JSON.parse(JSON.stringify(x));
  };

  // *******************************
  export const getDesignDoc = async (dbName:string, dbUrl:string): Promise<any> => {
    const n = Nano(dbUrl);
    
    await n.db.get(dbName);
  };
  
  export const compareDesignDocs =  async()


