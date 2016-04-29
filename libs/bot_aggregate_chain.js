var bot_aggregate_operations = require('./bot_aggregate_operations');
var bot_aggregate = require('./bot_aggregate');

var assert = require('assert');

var operations = Object.keys( bot_aggregate_operations );

function slice ( arrlike ) {
  return Array.prototype.slice.call(arrlike);
}

var bot_aggregate_chain = module.exports = function( options ) {
  if( arguments > 1 ){
    return bot_aggregate.apply(null, slice(arguments));
  }

  if( !( this instanceof bot_aggregate_chain ) ){
    return new bot_aggregate_chain(options);
  }

  var self = this;
  self.operations = [];
  self.inited = false;
  options = options || {};

  operations.forEach(function( op ) {
    self[op] = function() {
      assert( !self.inited, 'operations inited, could not modify it' );
      self.operations.push([op].concat(slice(arguments)));
      return self;
    }
  });

  self.exec = function( done ) {
    self.inited = true;
    bot_aggregate( self.operations, options, done);
  }

  return self;
}