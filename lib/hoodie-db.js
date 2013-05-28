var url = require('url'),
    http = require('http'),
    https = require('https'),
    Pouch = require('pouchdb'),
    async = require('async'),
    couchr = require('couchr'),
    stream = require('stream'),
    request = require('request'),
    _ = require('underscore');

/* API
two clients? one for stream responses through web api, the other
wraps that in a nice callback json parsing style for workers to use?

Create this API for both CouchDb and PouchDB (backed by leveldb)

init(db_url/opts) // creates required dbs / ddocs
client(opts)
    databases
        add(name)
        remove(name)
        info(name)
        head(name) // streaming req client only
        exists(name) // worker wrapper only
        list()
        grantReadAccess(db, user(s)) // using user.id (not same as name)
        revokeReadAccess(db, user(s))
        grantWriteAccess(db, user(s))
        revokeWriteAccess(db, user(s))
        hasReadAccess(db, user)
        hasWriteAccess(db, user)
        publish(db) // make public
        unpublish(db) // make not public
        isPublic(db)
        // compact?
    users
        add(name, password)
        remove(name)
        changePassword(password)
        changeUsername(name)
        authenticate(name, password) // => true/false
    // handled by www layer instead?
    // sessions
    //    getToken(username, password)
    //    getUser(token)
    replicator
        // ... ?
    tasks
        subscribe(type)
        unsubscribe(type)
    docs
        all(db)
        save(db, doc)
        remove(db, id)
        get(db, id)
        saveBulk(db, docs) // overload save() instead?
        getBulk(db, ids) // overload get() instead?
*/



// enable the _all_dbs feature before creating databases
Pouch.enableAllDbs = true;


exports.createClient = function (options) {
    exports.validateOptions(options);

    function dbName(name) {
        return options.app_id + '/' + name;
    }

    function dbURL(name) {
        return url.resolve(options.db, encodeURIComponent(dbName(name)));
    }

    function isCouchDB(db) {
        var p = url.parse(db).protocol;
        return p === 'http:' || p === 'https:';
    }

    return {
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
                if (isCouchDB(options.db)) {
                    couchr.put(dbURL(name), function (err, data, res) {
                        if (res && res.statusCode === 412) {
                            // Pouch ignores error when db already exists
                            return updateQueue(null, {ok: true});
                        }
                        return updateQueue(err, data, res);
                    });
                }
                else {
                    Pouch({name: dbURL(name)}, updateQueue);
                }
                // TODO: db_updates queue
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
                Pouch.destroy(dbURL(name), updateQueue);
                // TODO: db_updates queue
                /*
                var opts = {url: '/' + encodeURIComponent(dbName(name))};
                request.del(createOptions(opts), onsuccess(
                    function (res, body, next) {
                        options.queue.publish(options.app_id + '/_db_updates', {
                            dbname: dbName(name),
                            type: 'deleted'
                        },
                        next);
                    },
                    callback
                ));
                */
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
                        return (
                            db.slice(0, options.app_id.length + 1) ===
                            options.app_id + '/'
                        );
                    });
                    var names = appdbs.map(function (db) {
                        return db.split('/').slice(1).join('/');
                    });
                    callback(null, names);
                };
                if (isCouchDB(options.db)) {
                    couchr.get(url.resolve(options.db, '/_all_dbs'), cb);
                }
                else {
                    Pouch.allDbs(cb);
                }
            }
        }
    };
};

exports.validateOptions = function (options) {
    if (!options.db) {
        throw new Error('Missing database location in options.db');
    }
    if (!options.app_id) {
        throw new Error('Missing app id in options.app_id');
    }
    if (!options.admins) {
        throw new Error('Missing app admin db name in options.admins');
    }
    if (!options.queue) {
        throw new Error('Missing message queue client in options.queue');
    }
};
