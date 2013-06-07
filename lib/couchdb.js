var url = require('url'),
    utils = require('./utils'),
    Pouch = require('pouchdb'),
    couchr = require('couchr'),
    uuid = require('uuid');


module.exports = function (options, callback) {
    function dbName(name) {
        return name;
        // for multiple apps on one couchdb in the future
        //return options.app_id + '/' + name;
    }

    function dbURL(name) {
        return url.resolve(options.db, encodeURIComponent(dbName(name)));
    }

    function userID(username) {
        return 'org.couchdb.user:user/' + username;
    }

    function userDB() {
        return url.resolve(options.db, options.users_db + '/');
    }

    function userURL(username) {
        return url.resolve(userDB(), encodeURIComponent(userID(username)));
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
                Pouch.destroy(dbURL(name), utils.wrapPouchErrors(callback));
            },
            info: function (name, callback) {
                Pouch(dbURL(name)).info(utils.wrapPouchErrors(callback));
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
            },
            // TODO: use follow for more efficient changes feed listening?
            // The Pouch client uses longpolling
            changes: function (db, opts, /*optional*/callback) {
                // we can't just return Pouch(dbURL(db)).changes(opts), since
                // the api may not be ready and we don't get the changes object
                // back, so we have to use a callback instead
                Pouch(dbURL(db), function (err, api) {
                    if (err) {
                        if (callback) {
                            return callback(err);
                        }
                        throw err;
                    }
                    var feed = api.changes(opts);
                    if (callback) {
                        return callback(null, feed);
                    }
                });
            }
        },
        users: {
            add: function (username, password, callback) {
                /*
                var iterations = 10000;
                var salt = uuid.v4();
                var keylen = 40;

                // used to identify user even after login name change
                var hash = uuid.v4();

                crypto.pbkdf2(
                    password, salt, iterations, keylen,
                    function (err, derived_key) {
                        var doc = {
                            _id: userID(username),
                            name: 'user/' + username,
                            type: 'user',
                            roles: [hash],
                            salt: salt,
                            iterations: iterations,
                            derived_key: derived_key,
                            password_scheme: 'pbkdf2',
                            hash: hash
                        };
                        Pouch(dbURL(options.users_db)).post(
                            doc,
                            utils.wrapPouchErrors(callback)
                        );
                    }
                );
                */
                // used to identify user even after login name change
                var hash = uuid.v4();
                var doc = {
                    _id: userID(username),
                    name: 'user/' + username,
                    type: 'user',
                    roles: [hash],
                    password: password,
                    hash: hash
                };
                couchr.put(userURL(username), doc, callback);
            },
            get: function (username, callback) {
                couchr.get(userURL(username), callback);
            },
            remove: function (doc, callback) {
                couchr.del(
                    userURL(doc.name.replace(/^user\//, '')),
                    {rev: doc._rev},
                    callback
                );
            }
        }
    };

    callback(null, api);
};
