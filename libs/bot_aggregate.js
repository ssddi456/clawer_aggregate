var path    = require('path');
var debug_name = path.basename(__filename,'.js');
(require.main === module) && (function(){
    process.env.DEBUG = '*';
})()
var debug = require('debug')(debug_name);


var async = require('async');
var _ = require('underscore');
var commands = require('./bot_aggregate_operations');
var nedb = require('nedb');



function normalize_operation( operations, context ) {
  return operations.map(function( op, idx ) {
    switch(op[0]) {
      case 'grep':
        var urls = op[1];
        var urlkey = op[2];
        var unpack_options = op[3];


        if( idx == 0 ){
          if( !unpack_options ){
            unpack_options = urlkey;
            urlkey = '$url';
          }

          if( !Array.isArray(urls) ){
            urls = [urls];
          }

          if( urls.every(function( url ) {
              return typeof url == 'string'
            })
          ){
            urls = urls.map(function(url) {
              return { url : url };
            });
            urlkey = '$url';
          }
        } else {
          unpack_options = urlkey;
          urlkey = urls;
        }
        if( typeof unpack_options == 'function' ){

        } else{
          var text_commands = ['json','jsonp', 'content'];

          var commands = _.map(unpack_options,function( selector, k ) {
            if( k[0] == '$' ){
              return;
            }
 
            if( !Array.isArray(selector) ){
              unpack_options[k] = [selector];
              return selector;
            }
            return selector[0];
          });

          if( commands.every(function(c) {
                return text_commands.indexOf(c) != -1;
              })
          ){
            unpack_options['$type'] = 'text';
          } else if( commands.some(function(c) {
              return text_commands.indexOf(c) != -1;
            })
          ){
            throw new Error('illegel body parse command');
          } else {
            unpack_options['$type'] = 'dom';
          }

          _.each(unpack_options, function( selector, k ) {
            if( k[0] == '$' ){
              return;
            }

            switch( selector[0] ){
              case 'regex':
                var replace_func
                if( !selector[2] ){
                  replace_func = function($,$1){ return $1; };
                } else if( typeof selector[2] == 'string' ){
                  replace_func = new Function('$', '$1', '$2', '$3', '$3', 'return ' + selector[2] + ';');
                } else if( typeof selector[2] == 'function' ){
                  replace_func = selector[2];
                } else {
                  throw new Error('regex replace params');
                }
                selector[2] = replace_func;
                break;
              default:
                return;
            } 
          });
        }

        if( idx == 0 ){
          op = ['grep', urls, urlkey, unpack_options];
        } else{
          op = ['grep', urlkey, unpack_options];
        }
        return { operation : op, idx : idx, finished : false };
        break;
      default:
        return { operation : op, idx : idx, finished : false };
    }
  });
}

// 
// 检查可以重用哪些步骤
// 
function update_operations( old_ops, new_ops ) {

  var late_finished = true;
  new_ops.forEach(function( op, idx ) {
    debug( '-- check step ', idx, late_finished);
    var old_op = old_ops[idx];

    debug( 'old_op', old_op );
    // 
    // 如果原本没有这一步， 
    // 或者之前的结果已经不能用
    // 清除这一步上一次的结果
    // 
    if(!old_op || !late_finished){
      late_finished = false;
      op.res = undefined;
      op.finished = false;
      debug('--- no old op ---', idx);
      return;
    }


    var op_cmd = op.operation;
    var old_cmd = old_op.operation;

    // 
    // 如果指令长度不同
    // 或者指令内容不同
    // 清除这一步上一次的结果
    // 
    debug( 'len the same', op_cmd.length, old_cmd.length);

    if( op_cmd.length != old_cmd.length
      || !op_cmd.every(function( cmd, idx ) {
        var o_cmd = old_cmd[idx];

        if( cmd == o_cmd ){
          return true;
        }

        var t_cmd = typeof cmd;
        var t_o_cmd = typeof o_cmd;

        if( t_cmd == 'function' ){
          if( o_cmd.toString() == cmd.toString() ){
            return true;
          }
        }
        
        if( t_cmd == t_o_cmd ){
          if( JSON.stringify( cmd ) == JSON.stringify(o_cmd) ){
            return true;
          }
        }

        debug( 'different', cmd, o_cmd);
      })
    ){
      late_finished = false;
      op.res = undefined;
      op.finished = false;
      return;
    }

    op.res = old_op.res;
    op.finished = old_op.finished;
  });
}
function load_progress( id, context, done ) {
  var debug = context.debug;
  if(!id){
    debug('load_progress','aggregate with no db, continue');
    return done();
  }

  context.db = new nedb({ filename : path.join(__dirname,'../storage/aggregate_progess.db'), autoload: true });

  context.db.findOne({ aggregate_id : id },function( err, doc ) {
    debug( 'load records', arguments );
    if( err ){
      debug('aggregate id', id, 'no record');
      done();
      return;
    }
    if( doc && doc.operation ){
      update_operations(doc.operation, context.operation);
    }
    done();
  });
}

function dump_progress( id, context, done ) {
  var debug = context.debug;
  if(!context.db){
    debug('dump_progress', 'aggregate with no db, continue');
    return done();
  }

  var operations = context.operation.map(function( n ) {

    n.operation = n.operation.map(function( p ) {
      if(typeof p == 'function'){
        return p.toString();
      }
      return p;
    });

    return n;
  });

  context.db.update(
    { aggregate_id : id },
    { $set : { operation : operations }},
    { upsert : 1 },
    done);
}

module.exports =  function( operation, options, done ) {
  /*
    [
      [grep, urls, { 
        proper : [ herf : ] 
      }],
      [project, []],
      [grep, []]
    ]
   */

  if( typeof options == 'function'){
    done = options;
    options = {};
  }


  debug('options', options);

  var context = {
    options : options,
    cache   : undefined,
    debug   : debug
  };

  operation = normalize_operation(operation, context);
  context.operation = operation;

  process.on("uncaughtException",function(e) {
    // and kill also should be here
    debug('uncaughtException', e );
    debug( e.stack );
    dump_progress(options.opid, context, function() {
      process.exit();
    });
  });

  process.on('SIGTERM', function() {
    dump_progress(options.opid, context, function() {
      process.exit();
    });
  });

  async.waterfall([
    function( done ) {
      load_progress( options.opid, context, done);
    },
    function( done ) {

      operation.forEach(function( step ) {
        debug('progress info', step.operation, step.finished);
      });

      var q = async.queue(function( step, done ) {
        var idx = step.idx;
        var operation = step.operation;

        var command = operation[0];
        var params = operation.slice(1);

        if( step.finished && step.res ){
          context.cache = JSON.parse(step.res);
          done();
          return;
        }

        if( context.cache ){
          params.unshift(context.cache);
          context.cache = null;
        }

        var d = require('domain').create();

        var safe_done = function() {
            d.exit();
            done.apply(null, arguments);
        }
        params.unshift(context);

        params.unshift(function( err, res) {
          if( err ){
            debug( err.message );
            debug( err.stack );
            console.log( err.message, err.stack );
            throw new Error('no res');
          } else {
            //
            // 缓存这一步的结果以备重试
            // 

            res = _.flatten(res,true);

            step.finished = true;
            step.res = JSON.stringify(res);
            context.cache = res;
            debug( res );
            safe_done();
          }
        });

        debug('do command', command, idx);
  
        d.run(function(){
          commands[command].apply(null, params);
        });
        d.on('error',function(e) {
          debug( e.message );
          debug( e.stack );
          console.log( e.message, e.stack );
          q.kill();
          safe_done(e, context.cache);
        });

      },1);


      q.drain = function(){
        done(null, context.cache);
      };

      q.push(operation);

    },
    function() {

      var args = [].slice.call(arguments);
      var done = args.pop();
      args.unshift(null);

      debug('finish, do dump');
      dump_progress( options.opid, context, function() {
        done.apply(null, args);
      });

    }], done)
}