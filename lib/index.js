var couchr = require('couchr'),
    async = require('async'),
    url = require('url'),
    _ = require('underscore');


var uc = encodeURIComponent;


exports.createAPI = function (options, callback) {
    var parsed = url.parse(options.couchdb.url);
    parsed.auth = options.couchdb.user + ':' + options.couchdb.pass;
    var couch_url = url.format(parsed);

    /**
     * Pre-bind all methods, so we can easily compose them with higher order
     * functions (eg, async) - we don't lots of these objects, so efficiency
     * isn't a big concern
     */

    var hoodie = {};

    hoodie._resolve = function (path) {
        return url.resolve(couch_url, path);
    };

    hoodie.request = function (method, path, opt, callback) {
        return couchr.request(
            method,
            hoodie._resolve(path),
            opt.data,
            opt,
            callback
        );
    };

    // These are populated before calling the callback
    var app_config = {};
    var plugin_config = {};

    var remote_config = async.queue(function (task, callback) {
        var url = '/plugins/plugin%2F' + options.name;
        hoodie.request('GET', url, function (err, doc) {
            doc.config = _.extend(doc.config, plugin_config);
            hoodie.request('PUT', url, {data: doc}, function (err) {
                if (err) {
                    console.error(
                        'Error updating config for: ' + options.name + '\n' +
                        (err.stack || err.toString)
                    );
                }
                callback(err);
            });
        });
    }, 1);

    var plugin_feed = couchr.changes(hoodie._resolve('/plugins'));
    plugin_feed.on('change', function (change) {
        if (change.id === 'plugin/' + options.name) {
            var url = hoodie._resolve('/plugins/' + uc(change.id));
            couchr.get(url, function (err, doc) {
                if (!err) {
                    plugin_config = doc.config;
                }
            });
        }
    });

    var app_feed = couchr.changes(hoodie._resolve('/app'));
    app_feed.on('change', function (change) {
        if (change.id === 'config') {
            var url = hoodie._resolve('/app/config');
            couchr.get(url, function (err, doc) {
                if (!err) {
                    app_config = doc.config;
                }
            });
        }
    });

    hoodie.config = {
        get: function (key) {
            if (plugin_config.hasOwnProperty(key)) {
                return plugin_config[key];
            }
            return app_config[key];
        },
        set: function (key, value) {
            plugin_config[key] = value;
            remote_config.push({key: key, value: value});
        }
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
            hoodie.request('PUT', url, {data: doc}, callback);
        };
        db.find = function (type, id, callback) {
            var _id = toCouchID(type, id);
            var url = db._resolve(uc(_id));
            hoodie.request('GET', url, {}, function (err, doc) {
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
        db.findAll = function (type, callback) {
            if (!callback) {
                callback = type;
                type = null;
            }
            var url = db._resolve('_all_docs');
            var opt = {data: {include_docs: true}};
            if (type) {
                opt.data.start_key = JSON.stringify(type + '/');
                opt.data.end_key = JSON.stringify(type + '0');
            }
            hoodie.request('GET', url, opt, function (err, body) {
                if (err) {
                    return callback(err);
                }
                var docs = body.rows.map(function (r) {
                    return parseDoc(r.doc);
                });
                return callback(null, docs);
            });
        };
        db.remove = function (type, id, callback) {
            db.find(type, id, function (err, data) {
                if (err) {
                    return callback(err);
                }
                var _id = toCouchID(type, id);
                var url = db._resolve(uc(_id));
                var opt = {data: {rev: data._rev}};
                hoodie.request('DELETE', url, opt, callback);
            });
        };
        db.removeAll = function (type, callback) {
            db.findAll(type, function (err, data) {
                if (err) {
                    return callback(err);
                }
                docs = data.map(function (d) {
                    d._deleted = true;
                    return formatDoc(d);
                });
                var url = db._resolve('_bulk_docs');
                var opt = {data: {docs: docs}};
                hoodie.request('POST', url, opt, callback);
            });
        };
    };

    hoodie.database = function (name) {
        return new DatabaseAPI(name);
    };
    hoodie.database.add = function (name, callback) {
        var opt = {data: ''};
        hoodie.request('PUT', '/' + uc(name), opt, function (err, body) {
            if (err) {
                return callback(err);
            }
            return callback(null, new DatabaseAPI(name));
        });
    };
    hoodie.database.remove = function (name, callback) {
        hoodie.request('DELETE', '/' + uc(name), {}, callback);
    };
    hoodie.database.findAll = function (callback) {
        hoodie.request('GET', '/_all_dbs', {}, function (err, data, res) {
            if (err) {
                return callback(err);
            }
            var dbs = data.filter(function (db) {
                return db[0] !== '_';
            });
            return callback(null, dbs, res);
        });
    };

    hoodie.user = function (username) {
        var _id = 'org.couchdb.user:' + username;
        var url = hoodie._resolve('/_users/' + uc(_id));
        var user = {};
        user.get = function (callback) {
            hoodie.request('GET', url, callback);
        };
        user.remove = function (callback) {
            user.get(function (err, doc) {
                if (err) {
                    return callback(err);
                }
                var opt = {data: {rev: doc._rev}};
                hoodie.request('DELETE', url, opt, callback);
            });
        };
        return user;
    };

    hoodie.user.add = function (username, password, callback) {
        var doc = {
            _id: 'org.couchdb.user:' + username,
            name: username,
            password: password,
            type: 'user',
            roles: []
        };
        var url = hoodie._resolve('/_users/' + uc(doc._id));
        hoodie.request('PUT', url, {data: doc}, callback);
    };

    hoodie.user.findAll = function (callback) {
        var url = hoodie._resolve('/_users/_all_docs');
        var opt = {data: {
            include_docs: true,
            start_key: JSON.stringify('org.couchdb.user:'),
            end_key: JSON.stringify('org.couchdb.user{}')
        }};
        hoodie.request('GET', url, opt, function (err, body) {
            if (err) {
                return callback(err);
            }
            var docs = body.rows.map(function (r) {
                return r.doc;
            });
            return callback(null, docs);
        });
    };
    hoodie.user.remove = function (username, callback) {
    };

    // stops listening to changes feeds etc.
    hoodie._stop = function (callback) {
        plugin_feed.on('stop', function () {
            app_feed.on('stop', function () {
                if (callback) {
                    callback();
                }
            });
            app_feed.stop();
        });
        plugin_feed.stop();
    };

    // Initialize plugin config using database
    initPluginConfig(options, hoodie, function (err, cfg) {
        if (err) {
            return callback(err);
        }
        plugin_config = cfg;
        getAppConfig(hoodie, function (err, appcfg) {
            if (err) {
                return callback(err);
            }
            app_config = appcfg;
            callback(null, hoodie);
        });
    });

};


function initPluginConfig(options, hoodie, callback) {
    var plugin_cfg_url = hoodie._resolve('/plugins/plugin%2F' + options.name);
    couchr.get(plugin_cfg_url, function (err, doc, res) {
        if (res.statusCode === 404) {
            var cfg = {name: options.name};
            couchr.put(plugin_cfg_url, {config: cfg}, function (err) {
                if (err) {
                    return callback(err);
                }
                return callback(null, cfg);
            });
            return;
        }
        return callback(err, doc.config);
    });
}

function getAppConfig(hoodie, callback) {
    couchr.get(hoodie._resolve('/app/config'), function (err, body) {
        return callback(err, body && body.config);
    });
}


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
