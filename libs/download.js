var req = require('./req');
var cheerio = require('cheerio');
var iconvLite = require('iconv-lite');

module.exports = function( url, encode, option, done  ) {
  if( typeof encode == 'function' ){
    done = encode;
    option = {};
    encode = undefined;
  }

  if( typeof option == 'function' ){
    done = option;
    if( typeof encode == 'string' ){
      option = {}
    }
    else {
      option = encode;
      encode = undefined;
    }
  }

  var buffer = [];
  var r = req(url, option);

  function once () {
    once = function() {}
    done.apply(null,arguments);
  }

  r.on('data',function( chuck ) {
    buffer.push(chuck);
  });

  r.on('end',function() {
    buffer = Buffer.concat(buffer);
    var $ = cheerio.load(buffer);
    var declared_charset = ''
    var charset_node = $('meta[charset]');
    if( charset_node.length ){
      declared_charset = charset_node.attr('charset');
    } else {
      charset_node = $('meta[http-equiv="Content-Type"]');
      if( charset_node.length ){
        declared_charset = charset_node.attr('content');
        if( declared_charset ){
          declared_charset = declared_charset.match(/charset=(.*)/)
          declared_charset = declared_charset ? declared_charset[1] : '';
        }
      }
    }

    encode = encode || declared_charset;
    if( encode.match && encode.match('gb') ){
      buffer = iconvLite.decode( buffer, encode );
      $ = cheerio.load(buffer);
    } else {
      // console.log( encode, declared_charset );
    }

    once( null, $, buffer.toString());
  });

  r.on('error',function(e) {
    once(e);
  });
}