var url = require('url'),
    Pouch = require('pouchdb'),
    couchr = require('couchr');


module.exports = function (options, callback) {
    function dbName(name) {
        return options.app_id + '/' + name;
    }

    function dbURL(name) {
        return url.resolve(options.db, encodeURIComponent(dbName(name)));
    }

    var api = {
        databases: {
            add: function (name, callback) {
                function updateQueue(err, response) {
                    if (err) {
                        return callback(err);
                    }
                    options.queue.publish(options.app_id + '/_db_updates', {
                        dbname: dbName(name),
                        type: 'created'
                    },
                    function (err) {
                        return callback(err, response);
                    });
                }
                couchr.put(dbURL(name), function (err, data, res) {
                    if (res && res.statusCode === 412) {
                        // Pouch ignores error when db already exists
                        return updateQueue(null, {ok: true});
                    }
                    return updateQueue(err, data, res);
                });
            },
            remove: function (name, callback) {
                function updateQueue(err, response) {
                    if (err) {
                        return callback(err);
                    }
                    options.queue.publish(options.app_id + '/_db_updates', {
                        dbname: dbName(name),
                        type: 'deleted'
                    },
                    function (err) {
                        return callback(err, response);
                    });
                }
                // Pouch doesn't add the prefix when deleting (0.0.12 on npm)
                Pouch.destroy(dbURL(name), updateQueue);
            },
            info: function (name, callback) {
                Pouch(dbURL(name)).info(callback);
            },
            list: function (callback) {
                var cb = function (err, data) {
                    if (err) {
                        return callback(err);
                    }
                    var appdbs = data.filter(function (db) {
                        return db && (
                            db.slice(0, options.app_id.length + 1) ===
                            options.app_id + '/'
                        );
                    });
                    var names = appdbs.map(function (db) {
                        return db.split('/').slice(1).join('/');
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
