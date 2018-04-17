var map = function(doc) {
    emit(doc.name, null);
  };
  
  
  module.exports = {
    _id: "_design/testy",
    views: {
      test1: {
        map: map.toString(),
        reduce: "_count"
      }
    }
  };