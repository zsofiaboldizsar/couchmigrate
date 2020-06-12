import * as Nano from 'nano';
import { createLogger, format, Logger, transports } from 'winston';

import { DBSettings } from './model';

export class CouchDBClient {

  db: any;
  logger: Logger;

  constructor(dbSettings: DBSettings, logger: Logger) {
    this.logger = logger;

    const url = (dbSettings.dbURL) ?
      `${dbSettings.dbURL}/${dbSettings.dbName}` :
      `https://${dbSettings.dbUsername}:${dbSettings.dbPassword}@${dbSettings.dbUsername}.${dbSettings.dbHost}/${dbSettings.dbName}`;

    // tslint:disable-next-line: no-require-imports
    return require('nano')({
      url,
      requestDefaults: {
        timeout: 10000,
        headers: {
          'User-Agent': 'couchmigrate',
          'x-cloudant-io-priority': 'low',
        },
      },
    });
  }

  async copyDocument(sourceId: string, destinationId: string): Promise<void> {
    /* steps :
        1. Fetch source document
        2. Fetch destination document
        3. Overwrite the Destination

    */
    const sourceDoc = await this.fetchDocument(sourceId);
    const destinationDoc = await this.fetchDocument(destinationId);

    return this.upsertDocument(sourceDoc, destinationDoc ? destinationDoc : {_id: destinationId});
  }

  async deleteDocument(docId: string): Promise<any> {
    const logger = createLogger();

    try {
      logger.log('## Delete Document - Looking for docid', docId); // do I need to get it?
      const doc = await this.db.get(docId);

      logger.log('## Delete Document - Deleting ', docId, doc._rev);

      return this.db.destroy(docId, doc._rev);

    } catch (error) {
        logger.error(`Error: ${error.message}`);
        throw error;
    }
  }

  async fetchDocument(documentId: string): Promise<any> {
    this.logger.log('## copydoc - Fetching from', documentId);

    return this.db.get(documentId);
  }

  async upsertDocument(sourceDocument: any, destinationDocument: any): Promise<void> {

      // overwrite the destination
      this.logger.log('## copy Document - Writing new to ', destinationDocument._id);
      sourceDocument._id = destinationDocument._id;
      sourceDocument._rev = destinationDocument ? destinationDocument._rev : undefined;
      this.logger.log('## copydoc - contents', sourceDocument);

      return this.db.insert(sourceDocument);
  }

}
