var request = require('request');

module.exports = request.defaults({
  pool : {
    maxSocket : 10
  },
  // proxy : 'http://localhost:8888'
});