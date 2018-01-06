clawer_aggregate
==================================

a simple scriptable spider 

事实证明这个api设计是一个非常难以记忆并且蹩脚的设计。连我自己都记不住，怎么能叫好用？

需要重来。


### api

aggregate([aggregate pipeline], options, callback );

### aggregate pipeline

#### stages : (may method is better?)

* grep "url"|[url]|[result{}] options{}

* unwind {options}

* project {options}

* filter iterator(res{}):boolean
* each iterator(res{}):any
* map iterator(res{}):res{}
* reduce iterator(res{}):res{}
* sortBy iterator(res{}):sortByValue
* reverse

* custom iterator()

* out filename template

### options
{
  opid  : string,        // give current task a persistence progress store
  debug : boolean        // print debug info
  net   : {
    times: 5,            // async.retry
    interval: 0,
    [request options]
  },
  concurrency : {
    host  : {
      [url] : {
        count    : 5,    // per host queue length
        interval : 10e3  // per request interval
      }
    }
  }
}

### todos
unit test