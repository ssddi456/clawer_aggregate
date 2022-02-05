var path    = require('path');
var debug_name = path.basename(__filename,'.js');
(require.main === module) && (function(){
    process.env.DEBUG = '*';
})()
var debug = require('debug')(debug_name);
var util = require('util');
var _ = require('underscore');


module.exports = function extract_object(done, unpack_options, page_url, obj) {
    return function (err, res) {
        if (err) {
            done(err);
        } else {
            var $ = res[0];
            var content = res[1];
            var buffer = res[2];

            if (typeof unpack_options == "function") {
                unpack_options($, content, function (err, res) {
                    if (err) {
                        done(err);
                    } else {
                        if (!Array.isArray(res)) {
                            res = [res];
                        }

                        res = res.map(function (n) {
                            if (typeof n == "string") {
                                n = { content: n };
                            }
                            util._extend(n, obj);
                            return n;
                        });

                        done(null, res);
                    }
                });
            } else {
                if (unpack_options["$type"] == "text") {
                    _.each(unpack_options, function (selector, key) {
                        if (key[0] == "$") {
                            return;
                        }
                        var type = selector[0];
                        switch (type) {
                            case "buffer":
                                obj[key] = buffer;
                                return;

                            case "content":
                                obj[key] = content;
                                return;

                            case "regex":
                                obj[key] = content.replace(
                                    selector[1],
                                    selector[2]
                                );
                                return;

                            case "json":
                                obj[key] = JSON.parse(content);
                                return;

                            case "jsonp":
                                (function () {
                                    var unwrap = {};
                                    var ret;
                                    var callback_name = get_ref(
                                        selector[1],
                                        obj
                                    );
                                    var getter = function (data) {
                                        ret = data;
                                    };
                                    unwrap[callback_name] = getter;

                                    try {
                                        with (unwrap) {
                                            eval(content);
                                        }
                                    } catch (e) {
                                        try {
                                            callback_name = e.message.match(
                                                /(.*) is not defined/
                                            )[1];
                                            unwrap[callback_name] = getter;
                                            debug(
                                                "jsonp unwrap retry",
                                                callback_name
                                            );
                                            with (unwrap) {
                                                eval(content);
                                            }
                                        } catch (e) {
                                            debug("jsonp error", e);
                                        }
                                    }

                                    obj[key] = ret;
                                })();
                                return;
                        }
                    });
                } else {
                    if (unpack_options["$context"]) {
                        var $context = $(unpack_options["$context"]);
                        debug("context element count", $context.length);
                        if (!$context.length) {
                            debug(
                                "$context not found",
                                unpack_options["$context"]
                            );
                            done(new Error("$context not found"));
                        }
                        var ret = [];
                        $context.each(function (idx) {
                            ret.push(util._extend({}, obj));
                        });
                        obj = ret;
                    } else {
                        obj = [obj];
                    }
                    obj.forEach(function (obj, idx) {
                        _.each(unpack_options, function (selector, key) {
                            if (key[0] == "$") {
                                return;
                            }

                            var type = selector[0];
                            var accessor;
                            var res = [];

                            switch (type) {
                                case "content":
                                    obj[key] = content;
                                    return;

                                case "regex":
                                    obj[key] = content.replace(
                                        selector[1],
                                        selector[2]
                                    );
                                    return;

                                // dom相关内容
                                case "text":
                                    accessor = function (node) {
                                        return $(node).text();
                                    };
                                    break;

                                case "html":
                                    accessor = function (node) {
                                        return $(node).html();
                                    };
                                    break;

                                case "href":
                                case "src":
                                    accessor = function (node) {
                                        var link = $(node).attr(type) || "";
                                        return url.resolve(page_url, link);
                                    };
                                    break;

                                default:
                                    if (type.indexOf("attr") == 0) {
                                        type = type.replace("attr:", "");
                                        accessor = function (node) {
                                            return $(node).attr(type);
                                        };
                                    }
                            }

                            if (accessor) {
                                debug(
                                    "context element info",
                                    $context,
                                    $context && $context.length
                                );

                                if (type == "attr") {
                                    obj[key] = $context
                                        .eq(idx)
                                        .attr(selector[1]);
                                    return;
                                }

                                var els;
                                if ($context) {
                                    els = $context.eq(idx);
                                    if (selector[1]) {
                                        els = els.find(selector[1]);
                                    }
                                } else {
                                    if (selector[1]) {
                                        els = $(selector[1]);
                                    } else {
                                        els = $("*");
                                    }
                                }

                                if (!els.length) {
                                    debug("element not found");
                                    // debug( content );
                                } else {
                                    els.each(function () {
                                        res.push(accessor(this));
                                    });
                                    if (res.length == 1) {
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
    };
};
