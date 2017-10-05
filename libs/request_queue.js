var async = require('async');
var util = require('util');
var url = require('url');

var instance_id = 0;
var queue_map = {};

var request_queue = module.exports = function( req, options, domain ) {
  var this_instanc_id = ++instance_id;

  if( options === 0  ){
    options = { count : Infinity };
  } else {
    options = options || {};
    options = util._extend({
      count    : 5,
      interval : 10e3
    }, options);
  }

  // so this should be the bucket
  var counter = 0;
  var runningTask = 0;
  var hangups = [];

  var q = async.queue(function( task, done) {
    function work () {
      var args = task.slice();
      counter += 1;
      runningTask ++;

      hangups.push(task);

      setTimeout(function() {
        counter -= 1;
      }, options.interval);
      function callDone() {
          runningTask --;

          hangups.splice(hangups.indexOf(task), 1);

          done.apply( this, arguments);
      }
      args.push(callDone);

      req.apply(req, args);
    }

    if( counter >= options.count ){
      q.pause();
      setTimeout(function() {
        q.resume();
        work();
      }, options.interval);
    } else {
      work();
    }
  },5);

  function logQueueStatus () {
    console.log('request_queue', domain, 'started', q.started, 'paused', q.paused, 'length', q.length(), 'runningTask', runningTask, 'counter', counter);
    console.log('hangups', hangups);
    setTimeout(logQueueStatus, 10e3);
  }
  setTimeout(logQueueStatus, 10e3);

  return {
    req : function() {
      var args = [].slice.call(arguments);
      var done = args.pop();
      q.push([args],done);
    },
    get_queue : function(req_url, opt) {
      if( !req_url ){
        return this;
      }

      req_url = url.parse(req_url);
      var domain = req_url.host;

      if( !(domain in queue_map) ){
        queue_map[domain] = request_queue( req, opt === undefined ? options : opt, domain );
      }

      return queue_map[domain];
    }
  }
}


if(require.main === module){
  (function(){
    
    var c = 0;
    var start = Date.now();
    var q = module.exports(function( url, done ) {
      console.log( url );
      c += 1;

      console.log( 'n/m', c * 60e3 / (Date.now() - start) );

      setTimeout( function() {
        done(null, 'url ' + url);
      }, Math.random()*1000 );
    });
    for(var i = 0; i < 10000; i++){
      q.req(i,function( err, res ) {
        console.log( err, res );
      });
    }
  })();
}