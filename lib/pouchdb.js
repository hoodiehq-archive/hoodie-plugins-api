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
    utils = require('./utils'),
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
                Pouch({name: dbURL(name)}, utils.wrapPouchErrors(callback));
            },
            remove: function (name, callback) {
                // Pouch doesn't add the prefix when deleting (0.0.12 on npm)
                Pouch.destroy(dbURL(name), utils.wrapPouchErrors(callback));
            },
            info: function (name, callback) {
                Pouch(dbURL(name)).info(utils.wrapPouchErrors(callback));
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
                Pouch(dbURL(db)).allDocs(utils.wrapPouchErrors(callback));
            },
            save: function (db, doc, callback) {
                if (doc._id) {
                    Pouch(dbURL(db)).put(doc, utils.wrapPouchErrors(callback));
                }
                else {
                    Pouch(dbURL(db)).post(doc, utils.wrapPouchErrors(callback));
                }
            },
            get: function (db, id, callback) {
                Pouch(dbURL(db)).get(id, utils.wrapPouchErrors(callback));
            },
            remove: function (db, doc, callback) {
                Pouch(dbURL(db)).remove(doc, utils.wrapPouchErrors(callback));
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
