var req = require('request');
var cheerio = require('cheerio');
var iconvLite = require('iconv-lite');
var zlib = require('zlib');

var hangups = [];


// function logQueueStatus() {
//   console.log('download hangups', hangups);
//   setTimeout(logQueueStatus, 10e3);
// }
// setTimeout(logQueueStatus, 10e3);


var download = function(url, encode, option, done) {
  var task = {
    url: url,
    encode: encode,
    option: option,
    bufferLength: 0,
  };

  hangups.push(task);

  if (typeof encode == 'function') {
    done = encode;
    option = {};
    encode = undefined;
  }

  if (typeof option == 'function') {
    done = option;
    if (typeof encode == 'string') {
      option = {}
    } else {
      option = encode || {};
      encode = undefined;
    }
  }

  var buffer = [];
  var r = req(url, option);

  function once() {
    once = function() {};

    hangups.splice(hangups.indexOf(task), 1);

    done.apply(null, arguments);
  }

  r.on('data', function(chuck) {
    buffer.push(chuck);
    task.recieving = true;
    task.bufferLength += chuck.length;
    task.responseText = Buffer.concat(buffer).toString();
  });

  r.on('end', function() {
    task.recieving = false;;
    task.finish = true;

    buffer = Buffer.concat(buffer);

    var res_headers = r.response.headers;
    if (res_headers['content-encoding'] == 'gzip') {
      buffer = zlib.gunzipSync(buffer);
    }

    var $ = cheerio.load(buffer);
    var declared_charset = ''
    var charset_node = $('meta[charset]');
    if (charset_node.length) {
      declared_charset = charset_node.attr('charset');
    } else {
      charset_node = $('meta[http-equiv="Content-Type"]');
      if (charset_node.length) {
        declared_charset = charset_node.attr('content');
        if (declared_charset) {
          declared_charset = declared_charset.match(/charset=(.*)/)
          declared_charset = declared_charset ? declared_charset[1] : '';
        }
      }
    }

    encode = encode || declared_charset;
    if (encode.match && encode.match('gb')) {
      buffer = iconvLite.decode(buffer, encode);
      $ = cheerio.load(buffer);
    } else {
      // console.log( encode, declared_charset );
    }

    once(null, $, buffer.toString(), buffer);
  });

  r.on('error', function(e) {
    task.error = e;

    once(e);
  });
};

var request_queue = require('./request_queue');
module.exports = request_queue(download);