var url = require('url'),
    Pouch = require('pouchdb'),
    couchr = require('couchr');


module.exports = function (options, callback) {
    function dbName(name) {
        return name;
        // for multiple apps on one couchdb in the future
        //return options.app_id + '/' + name;
    }

    function dbURL(name) {
        return url.resolve(options.db, encodeURIComponent(dbName(name)));
    }

    var api = {
        databases: {
            add: function (name, callback) {
                couchr.put(dbURL(name), function (err, data, res) {
                    if (res && res.statusCode === 412) {
                        // Pouch ignores error when db already exists
                        return callback(null, {ok: true});
                    }
                    return callback(err, data, res);
                });
            },
            remove: function (name, callback) {
                // Pouch doesn't add the prefix when deleting (0.0.12 on npm)
                Pouch.destroy(dbURL(name), callback);
            },
            info: function (name, callback) {
                Pouch(dbURL(name)).info(callback);
            },
            list: function (callback) {
                var cb = function (err, data) {
                    if (err) {
                        return callback(err);
                    }
                    var names = data.filter(function (db) {
                        return db[0] !== '_';
                    });
                    callback(null, names);
                };
                couchr.get(url.resolve(options.db, '/_all_dbs'), cb);
            }
        },
        docs: {
            all: function (db, callback) {
                Pouch(dbURL(db)).allDocs(callback);
            },
            save: function (db, doc, callback) {
                if (doc._id) {
                    Pouch(dbURL(db)).put(doc, callback);
                }
                else {
                    Pouch(dbURL(db)).post(doc, callback);
                }
            }
        }
    };

    callback(null, api);
};
