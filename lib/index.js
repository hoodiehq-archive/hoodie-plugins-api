var couchr = require('couchr'),
    url = require('url'),
    _ = require('underscore');


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

    function DatabaseAPI(name) {
        var db_url = '/' + uc(name) + '/';
        var db = this;

        db._resolve = function (path) {
            return url.resolve(db_url, path);
        };

        db.add = function (type, attrs, callback) {
            attrs.type = type;
            var doc = formatDoc(attrs);
            var url = db._resolve(uc(doc._id));
            that.request('PUT', url, {data: doc}, callback);
        };
        db.find = function (type, id, callback) {
            var _id = toCouchID(type, id);
            var url = db._resolve(uc(_id));
            that.request('GET', url, {}, function (err, doc) {
                return callback(err, err ? null: parseDoc(doc));
            });
        };
        db.update = function (type, id, attrs, callback) {
            db.find(type, id, function (err, data) {
                if (err) {
                    return callback(err);
                }
                var data2 = _.extend(data, attrs);
                return db.add(type, data2, callback);
            });
        };
    };

    this.database = {
        add: function (name, callback) {
            var opt = {data: ''};
            that.request('PUT', '/' + uc(name), opt, function (err, body) {
                if (err) {
                    return callback(err);
                }
                return callback(null, new DatabaseAPI(name));
            });
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


/**
 * Document parsing / formating for CouchDB, taken from:
 * https://github.com/hoodiehq/hoodie.js/blob/master/src/core/remote.js
 */


/**
 * Valid CouchDB doc attributes starting with an underscore
 */

var validSpecialAttributes = [
    '_id',
    '_rev',
    '_deleted',
    '_revisions',
    '_attachments'
];

/**
 * Converts a type and a Hoodie id to a CouchDB id string
 */

function toCouchID(type, id) {
    return type + '/' + id;
}

/**
 * Prepare Hoodie document for storing in CouchDB
 */

function formatDoc(object) {
    var attr, properties;
    properties = _.extend({}, object);

    for (attr in properties) {
        if (properties.hasOwnProperty(attr)) {
            if (validSpecialAttributes.indexOf(attr) !== -1) {
                continue;
            }
            if (!/^_/.test(attr)) {
                continue;
            }
            delete properties[attr];
        }
    }

    // prepare CouchDB id
    properties._id = toCouchID(properties.type, properties.id);
    delete properties.id;
    return properties;
};


/**
 * Convert a CouchDB document to the Hoodie format
 */

function parseDoc(object) {
    var id, ignore, _ref;

    // handle id and type
    id = object._id || object.id;
    delete object._id;

    // turn doc/123 into type = doc & id = 123
    // NOTE: we don't use a simple id.split(/\//) here,
    // as in some cases IDs might contain "/", too
    _ref = id.match(/([^\/]+)\/(.*)/),
    ignore = _ref[0],
    object.type = _ref[1],
    object.id = _ref[2];

    return object;
};
