const assert = require('chai').assert;
const sinon = require("sinon");

const MigrationManager = require('../migrationManager.js');

describe('test migration API endpoint - trivial tests', () => {

 


  it('wrong endpoint, authentication failed response (401)', (done) => {
    const designDoc = '{"_id":"designDoc_name","_rev":"321"}';
    const settings = {
      dbHost:"fakehost",
      dbUsername: "fakeUsername",
      dbPassword: "fakePassword",
      dbName: "fakeDB",
      designDoc:designDoc
    }
    const parseResponse = function(err, data ){
      assert.equal(err.errno,"ENOTFOUND");
      done();
    }
      
    MigrationManager.doMigration(settings, parseResponse);
  });

});

describe('test migration API endpoint', () => {
  let settings;
beforeEach((done) => {
  const designDoc = {"_id":"designDoc_nametest","_rev":"321"};
  settings = {
    dbHost:process.env.DBHOST,
    dbUsername: process.env.DBUSERNAME,
    dbPassword: process.env.DBPASSWORD,
    dbName: process.env.DBNAME,
    designDoc
  }
  var skip = function(err,data){
    
    done();};
    done();
   // MigrationManager.doDelete(settings,skip);
});


  it('Do test migration - happy path, update needed,', (done) => {
    const now = new Date();
    const designDoc = {"_id":"designDoc-nametest_"+now.getTime(),"_rev":"321"};
    settings.designDoc = designDoc;

    const parseResponse = function(err, data ){
      
      assert.isNull(err,'there was no error');
      if (data){
        data.forEach(element => {
          if (element && Array.isArray(element) && element.length == 3 ) {
            const log = (typeof element[element.length-1] === 'object' ? 
                         element[element.length-1] :
                         JSON.parse(element[element.length-1]));
            assert.isTrue(log.ok);
            assert.equal(log.id.split()[0],"designDoc-nametest");    
          }
        });
        
      }
      done();
    }
    MigrationManager.doMigration(settings,parseResponse);
  });

  it('Do test migration - happy path, no modification needed', (done) => {
    const designDoc = {"_id":"designDoc_nametest","_rev":"321"};
    settings.designDoc = designDoc;
    const parseResponse = function(err, data ){
        assert.isNotNull(err);
        assert.isTrue(err);
        assert.equal(data[data.length-1].reason,`** The design document is the same, no need to migrate! **`);
      
      done();
    }
    const skip = function(err,data){

      MigrationManager.doMigration(settings,parseResponse);

    };
    MigrationManager.doMigration(settings,skip);
    
    
    
  });
})


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function takeBreak() {
  console.log('Taking a break...');
  await sleep(2000);
  console.log('Two second later');
}
