var path    = require('path');
var debug_name = path.basename(__filename,'.js');
(require.main === module) && (function(){
    process.env.DEBUG = '*';
})()
var debug = require('debug')(debug_name);

var async = require('async');
var url = require('url');
var fs = require('fs');
var _ = require('underscore');
var unwind = require('./unwind');
var util = require('util');

var download = require('./download');


function get_ref( key, obj) {
  if( key.indexOf('$') == 0 ){
    return obj[key.slice(1)];
  }
  return key;
}


module.exports = {
  /**
   * 爬取网页
   */
  'grep'   : function( done, context, urls, url_key, unpack_options ) {
    var options = context.options;

    debug( 'arguments.length', arguments.length );
    debug( 'urls', urls );
    debug( 'url_key', url_key );
    debug( 'unpack_options', unpack_options );

    var n = 0;
    var len = urls.length;

    var encoding;
    if( unpack_options.charset && typeof unpack_options.charset[0] == 'string'){
      encoding = unpack_options.charset[0];
      delete unpack_options.charset;
    }

    async.mapLimit(urls,5,function( obj, done ) {
      var page_url;

      obj = util._extend({}, obj);

      page_url = get_ref(url_key, obj);


      if( !page_url ){
        throw new Error('url not set');
      }

      console.log( 'page_url', page_url , ++n, len);

      var host = url.parse(page_url).host;

      async.retry(options.net, function(done) {

        download
          .get_queue(page_url, options.concurrency && (options.concurrency[host] || options.concurrency))
          .req(page_url, encoding, options.net, function(err, $, content, buffer){
            debug( 'downloaded content', content );
            done(err, [$,content, buffer]);

          });

      },function( err, res ){
        if(err){
          done(err);
        } else {
          var $ = res[0];
          var content = res[1];
          var buffer = res[2];

          if( typeof unpack_options == 'function' ){
            unpack_options( $, content, function( err, res ) {
              if( err ){
                done(err);
              } else {
                if( !Array.isArray(res) ){
                  res = [res];
                }

                res = res.map(function( n ) {
                  if( typeof n == 'string' ){
                    n = { 'content' : n };
                  }
                  util._extend(n, obj);
                  return n;
                });

                done(null, res);
              }
            });
          } else {
            if( unpack_options['$type'] == 'text' ){
              _.each(unpack_options,function( selector, key ) {
                if( key[0] == '$' ){
                  return;
                }
                var type = selector[0];
                var accessor;
                var res = [];

                switch(type){
                  case 'buffer' : 
                    obj[key] = buffer;
                  return;

                  case 'content' :
                    obj[key] = content;
                  return;

                  case 'regex':
                    obj[key] = content.replace(selector[1], selector[2]);
                  return;

                  case 'json' :
                    obj[key] = JSON.parse(content);
                  return;

                  case 'jsonp' :
                    (function(){
                      var unwrap = {};
                      var ret;
                      var callback_name = get_ref(selector[1], obj);
                      var getter = function( data ){ ret = data; };         
                      unwrap[callback_name] = getter;

                      try{
                        with(unwrap){
                          eval(content);
                        }
                      } catch(e){
                        try{
                          callback_name = e.message.match(/(.*) is not defined/)[1];
                          unwrap[callback_name] = getter;
                          debug('jsonp unwrap retry', callback_name);
                          with(unwrap){
                            eval(content); 
                          }
                        }catch(e){
                          debug('jsonp error' , e);
                        }
                      }

                      obj[key] = ret;
                    })();
                  return;
                }
              });

            } else {

              if( unpack_options['$context'] ){
                var $context = $(unpack_options['$context']);
                debug( 'context element count', $context.length );
                if( !$context.length ){
                  debug('$context not found', unpack_options['$context'] );
                  done( new Error('$context not found') );
                }
                var ret = [];
                $context.each(function( idx ) {
                  ret.push( util._extend({}, obj));
                });
                obj = ret;
              } else {
                obj = [obj];
              }
              obj.forEach(function( obj, idx ) {
                _.each(unpack_options,function( selector, key ) {
                  if( key[0] == '$' ){
                    return;
                  }

                  var type = selector[0];
                  var accessor;
                  var res = [];

                  switch(type){
                    case 'content':
                      obj[key] = content;
                    return;

                    case 'regex':
                      obj[key] = content.replace(selector[1], selector[2]);
                    return;

                    // dom相关内容
                    case 'text':
                      accessor = function(node) {
                        return $(node).text();
                      };
                    break;

                    case 'html':
                      accessor = function(node) {
                        return $(node).html();
                      };
                    break;

                    case 'href':
                    case 'src':
                      accessor = function(node) {
                        var link = $(node).attr(type) || '';
                        return url.resolve(page_url,link);
                      };
                    break;

                    default :
                      if( type.indexOf('attr') == 0 ){
                        type = type.replace('attr:','');
                        accessor = function(node) {
                          return $(node).attr(type);
                        };
                      }
                  }

                  if( accessor ){
                    debug( 'context element info', $context, $context && $context.length);

                    if( type == 'attr' ){
                      obj[key] = $context.eq(idx).attr(selector[1]);
                      return;
                    }

                    var els;
                    if( $context ){
                      els = $context.eq(idx);
                      if( selector[1] ){
                        els = els.find(selector[1]);
                      }
                    } else {
                      if( selector[1] ){
                        els = $(selector[1]);
                      } else {
                        els = $('*');
                      }
                    }

                    if( !els.length ){
                      debug('element not found');
                      // debug( content );
                    } else {
                      els.each(function() {
                        res.push(accessor(this));
                      });
                      if(res.length == 1){
                        res = res[0];
                      }

                      obj[key] = res;
                    }
                  }
                });
              });
            }
            done(null, obj);
          }
        }
      });
    },done);
  },
  /**
   * 按键拆分对象
   */
  'unwind' : function( done, context, res, keys ) {
    if(Array.isArray(res)){
      done(null, _.flatten(
                  res.map(function( node ) {
                    return unwind(node,keys);
                  })));
    } else {
      done(null, unwind(res,keys));
    }
  },
  /**
   * 字段值映射，调整数据结构的快捷方式
   */
  'project': function( done, context, res, projection ) {
    function project_properties( node ) {
      _.each(projection,function( source, target ) {
        switch(source){
          case  '$del':
            node[target] = undefined;
            return;
          default:
            node[target] = node[source];
        }
      });
    }
    if(Array.isArray(res)){
      res.forEach(project_properties);
    } else {
      project_properties(res);
    }
    done(null, res);
  },

  'slice': function(done, context, res, start, end) {
    done(null, res.slice.call(res, start, end));
  },
  /**
   * 过滤
   */
  'filter': function(done, context, res, filter) {
    done(null, res.filter(filter));
  },
  /**
   * 遍历
   */
  'each': function(done, context,res, mapper) {
    res.forEach(mapper);
    done(null, res);
  },
  /**
   * 映射
   */
  'map': function(done, context,res, mapper) {
    done(null, res.map(mapper));
  },
  /**
   * 归并
   */
  'reduce': function(done, context, res, reducer) {
    done(null, res.reduce(reducer));
  },
  /**
   * 根据某个键排序
   */
  'sortBy' : function(done, context, res, sort_by) {
    done(null, _.sortBy(res, sort_by));
  },
  /**
   * 数组反转
   */
  'reverse' : function(done, context, res ) {
    done(null, res.reverse());
  },
  /**
   * 自定义扩展设施
   */
  'custom' : function(done, context, res, handle) {
    var once = function(err, ret) {
      once = function() {};
      setTimeout(function() {
        done(err, ret);
      });
    };

    var ret = handle(res, once);
    if( ret ){
      once(null, ret);
    }
  },
  'out' : function(done, context, res, filename, format ) {
    if(!format){
      fs.writeFile(filename, JSON.stringify, done);
    } else {
      fs.writeFile(filename, 
        res.map(function( node ) {
          return format.replace(/\${([^}]+)}/,function($, $1) {
            return node[$1] || '';
          })
        }).join(''),
        done);
    }
  }
};
