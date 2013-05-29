var fs = require('fs'),
    url = require('url'),
    path = require('path'),
    http = require('http'),
    https = require('https'),
    Pouch = require('pouchdb'),
    async = require('async'),
    mkdirp = require('mkdirp'),
    couchr = require('couchr'),
    stream = require('stream'),
    request = require('request'),
    _ = require('underscore');


module.exports = function (options, callback) {
    function dbName(name) {
        return options.app_id + '/' + name;
    }

    function dbURL(name) {
        return path.resolve(Pouch.prefix, encodeURIComponent(dbName(name)));
    }

    // set pouch prefix to directory
    Pouch.prefix = path.resolve(options.db.replace(/^leveldb:\/\//, ''));
    // ensure there's a trailing slash
    if (Pouch.prefix[Pouch.prefix.length-1] !== '/') {
        Pouch.prefix += '/';
    }

    // enable the _all_dbs feature before creating databases
    // TODO: this doesn't work! - report issue on PouchDB
    //       for now I'm doing a work-around by reading the directory
    Pouch.enableAllDbs = true;

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
                Pouch({name: dbURL(name)}, updateQueue);
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
                // TODO: doesn't work
                //Pouch.allDbs(cb);

                var prefix = Pouch.prefix;
                function isDirectory(f, cb) {
                    fs.stat(path.resolve(prefix, f), function (err, stats) {
                        if (err) {
                            return cb(false);
                        }
                        return cb(stats.isDirectory());
                    });
                }
                fs.readdir(prefix, function (err, files) {
                    if (err) {
                        return callback(err);
                    }
                    async.filter(files, isDirectory, function (dirs) {
                        var dbs = dirs.filter(function (dir) {
                            return (
                                dir.slice(0, options.app_id.length + 3) ===
                                options.app_id + '%2F'
                            );
                        });
                        var names = dbs.map(function (db) {
                            var n = decodeURIComponent(db);
                            return n.slice(options.app_id.length + 1);
                        });
                        return callback(null, names);
                    });
                });
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

    mkdirp(Pouch.prefix, function (err) {
        if (err) {
            return callback(err);
        }
        return callback(null, api);
    });
};
