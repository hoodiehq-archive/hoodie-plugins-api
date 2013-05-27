var http = require('http'),
    https = require('https'),
    url = require('url'),
    request = require('request'),
    _ = require('underscore');


exports.createClient = function (options) {
    exports.validateOptions(options);

    function createOptions(opts) {
        opts.url = url.resolve(options.url, opts.url);
        return _.extend({
            auth: {
                user: options.user,
                pass: options.pass
            }
        }, opts);
    }

    function onsuccess(fn, next) {
        return function (err, res, body) {
            if (err) {
                return next(err, res, body);
            }
            if (res.statusCode >= 200 && res.statusCode < 300) {
                // success!
                fn(res, body, function (err) {
                    return next(err, res, body);
                });
            }
            else {
                return next(err, res, body);
            }
        }
    }

    /* API
    init(db_url/opts) // creates required dbs / ddocs
    client(opts)
        databases
            add(name)
            remove(name)
            info(name)
            exists(name)
            list()
            grantReadAccess(db, user(s))
            revokeReadAccess(db, user(s))
            grantWriteAccess(db, user(s))
            revokeWriteAccess(db, user(s))
            hasReadAccess(db, user)
            hasWriteAccess(db, user)
            publish(db) // make public
            unpublish(db) // make not public
            isPublic(db)
        users
            add(name, password) // => id
            remove(id)
            changePassword(password)
            changeUsername(name)
        sessions
            getToken(username, password)
            getUser(token)
        replicator
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

    return {
        databases: {
            create: function (name, callback) {
                // TODO: make private to _admin user on first create
                var dbname = options.app_id + '/' + name;
                var opts = {url: '/' + encodeURIComponent(dbname)};
                request.put(createOptions(opts), onsuccess(
                    function (res, body, next) {
                        options.queue.publish(options.app_id + '/_db_updates', {
                            dbname: dbname,
                            type: 'created'
                        },
                        next);
                    },
                    callback
                ));
            },
            remove: function (name, callback) {
                var dbname = options.app_id + '/' + name;
                var opts = {url: '/' + encodeURIComponent(dbname)};
                request.del(createOptions(opts), onsuccess(
                    function (res, body, next) {
                        options.queue.publish(options.app_id + '/_db_updates', {
                            dbname: dbname,
                            type: 'deleted'
                        },
                        next);
                    },
                    callback
                ));
            }
        }
    };
};

exports.validateOptions = function (options) {
    if (!options.url) {
        throw new Error('Missing CouchDB URL in options.url');
    }
    if (!options.user) {
        throw new Error('Missing CouchDB _admin username in options.user');
    }
    if (!options.pass) {
        throw new Error('Missing CouchDB _admin password in options.pass');
    }
    if (!options.app_id) {
        throw new Error('Missing app id in options.app_id');
    }
    if (!options.admin_db) {
        throw new Error('Missing app admin db name in options.admin_db');
    }
    if (!options.queue) {
        throw new Error('Missing message queue client in options.queue');
    }
};
