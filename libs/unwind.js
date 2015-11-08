
/**
 * unpack obj
 * unwind({ a: [1,2,3], b : ['a', 'b'] }, ['a','b'])
 * [
 *   { a : 1, b : 'a' },
 *   { a : 1, b : 'b' },
 *   { a : 2, b : 'a' },
 *   { a : 2, b : 'b' },
 *   { a : 3, b : 'a' },
 *   { a : 3, b : 'b' },
 * ]
 * 
 * @param  {} obj  
 * @param  {String[]} keys 
 * @return {[]}
 */
module.exports = function( obj, keys ) {
  var ret = [];
  var temp_obj_str= JSON.stringify(obj);

  if( keys.length == 1){
    keys = keys[0];
  }

  if(typeof keys == 'string' ){

    if(!(keys in obj) || !obj[keys].forEach){
      return obj;
    }

    obj[keys].forEach(function( v ) {
      var new_temp_obj = JSON.parse(temp_obj_str);
      new_temp_obj[keys] = v
      ret.push(new_temp_obj);
    });
    return ret;
  }

  var _keys = keys
                .filter(function( key ) {
                  return Array.isArray(obj[key])
                });

  var len_indexs = _keys
                    .map(function( key ){
                      return obj[key].length;
                    });

  var run_count = len_indexs.map(function(){ return 0; });
  var key_len = len_indexs.length;

  function check_run_count(){
    return run_count.every(function( n, i ) {
      return n < len_indexs[i];
    });
  }
  function increase_run_count(){

    var cursor = 0;
    while( cursor < key_len ){
      run_count[cursor] += 1;
      if( run_count[cursor] == len_indexs[cursor] ){
        if( cursor != key_len -1 ){
          run_count[cursor] = 0;
          cursor += 1;
        }
      } else {
        break;
      }
    }
  }

  while(check_run_count()){
    var new_temp_obj = JSON.parse(temp_obj_str);
    _keys.forEach(function(key, i) {
      new_temp_obj[key] = obj[key][ run_count[i] ];
    });
    ret.push(new_temp_obj);
    increase_run_count();
  }

  return ret.length? ret : [obj];
}

if(require.main === module){

  var assert = require('assert');
  assert.deepEqual( 
    module.exports({ a: [1,2,3], b : ['a', 'b'] }, ['a','b']), 
    [
      { a : 1, b : 'a' },
      { a : 2, b : 'a' },
      { a : 3, b : 'a' },
      { a : 1, b : 'b' },
      { a : 2, b : 'b' },
      { a : 3, b : 'b' }
    ],
    'unwind not compacted');
}