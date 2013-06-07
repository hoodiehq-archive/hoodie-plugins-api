var fs = require('fs'),
    url = require('url'),
    uuid = require('uuid'),
    path = require('path'),
    http = require('http'),
    https = require('https'),
    Pouch = require('pouchdb'),
    async = require('async'),
    crypto = require('crypto'),
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

    function userID(username) {
        return 'org.couchdb.user:user/' + username;
    }

    function userDB() {
        return dbURL(options.users_db);
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
                Pouch(dbURL(name), utils.wrapPouchCallback(callback));
            },
            remove: function (name, callback) {
                // Pouch doesn't add the prefix when deleting (0.0.12 on npm)
                Pouch.destroy(dbURL(name), utils.wrapPouchCallback(callback));
            },
            info: function (name, callback) {
                Pouch(dbURL(name)).info(utils.wrapPouchCallback(callback));
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
                Pouch(dbURL(db)).allDocs(utils.wrapPouchCallback(callback));
            },
            save: function (db, doc, callback) {
                if (doc._id) {
                    Pouch(dbURL(db)).put(doc, utils.wrapPouchCallback(callback));
                }
                else {
                    Pouch(dbURL(db)).post(doc, utils.wrapPouchCallback(callback));
                }
            },
            get: function (db, id, callback) {
                Pouch(dbURL(db)).get(id, utils.wrapPouchCallback(callback));
            },
            remove: function (db, doc, callback) {
                Pouch(dbURL(db)).remove(doc, utils.wrapPouchCallback(callback));
            },
            changes: function (db, opts, callback) {
                // we can't just return Pouch(dbURL(db)).changes(opts), since
                // the api may not be ready and we don't get the changes object
                // back, so we have to use a callback instead
                Pouch(dbURL(db), function (err, api) {
                    if (err) {
                        return callback(err);
                    }
                    var feed = api.changes(opts);
                    return callback(null, feed);
                });
            }
        },
        users: {
            add: function (username, password, callback) {
                console.log(['users.add', username, password]);
                try {
                    var iterations = 10000;
                    var salt = uuid.v4();

                    // see SHA1_OUTPUT_LENGTH in couchdb/couch_passwords.erl
                    var keylen = 20;

                    // used to identify user even after login name change
                    var hash = uuid.v4();
                }
                catch (e) {
                    return callback(e);
                }
                crypto.pbkdf2(
                    password, salt, iterations, keylen,
                    function (err, derived_key) {
                        if (err) {
                            return callback(err);
                        }
                        var doc = {
                            _id: userID(username),
                            name: 'user/' + username,
                            type: 'user',
                            roles: [hash],
                            salt: salt,
                            iterations: iterations,
                            derived_key: derived_key.toString('hex'),
                            password_scheme: 'pbkdf2',
                            hash: hash
                        };
                        Pouch(userDB()).put(
                            doc,
                            utils.wrapPouchCallback(callback)
                        );
                        console.log(userDB());
                    }
                );
            },
            get: function (username, callback) {
                console.log(['users.get', username]);
                Pouch(userDB()).get(
                    userID(username),
                    utils.wrapPouchCallback(callback)
                );
            },
            remove: function (doc, callback) {
                console.log(['users.remove', doc]);
                Pouch(userDB()).remove(
                    doc,
                    utils.wrapPouchCallback(callback)
                );
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
