var couchr = require('couchr'),
    url = require('url');


var uc = encodeURIComponent;


var PluginAPI = exports.PluginAPI = function PluginAPI(opt) {
    var parsed = url.parse(opt.url);
    parsed.auth = opt.user + ':' + opt.pass;
    var couch_url = url.format(parsed);

    /**
     * Pre-bind all methods, so we can easily compose them with higher order
     * functions (eg, async) - we don't lots of these objects, so efficiency
     * isn't a big concern
     */

    var that = this;

    this._resolve = function (path) {
        return url.resolve(couch_url, path);
    };

    this.request = function (method, path, opt, callback) {
        return couchr.request(
            method,
            that._resolve(path),
            opt.data,
            opt,
            callback
        );
    };

    this.database = {
        add: function (name, callback) {
            that.request('PUT', '/' + uc(name), {data: ''}, callback);
        },
        remove: function (name, callback) {
            that.request('DELETE', '/' + uc(name), {}, callback);
        },
        findAll: function (callback) {
            that.request('GET', '/_all_dbs', {}, function (err, data, res) {
                if (err) {
                    return callback(err);
                }
                var dbs = data.filter(function (db) {
                    return db[0] !== '_';
                });
                return callback(null, dbs, res);
            });
        }
    };
};
