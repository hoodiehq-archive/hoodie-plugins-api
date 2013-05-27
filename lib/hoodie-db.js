var http = require('http'),
    https = require('https'),
    url = require('url'),
    async = require('async'),
    request = require('request'),
    _ = require('underscore');


var STATUS_MSGS = {
    400: '400: Bad Request',
    401: '401: Unauthorized',
    402: '402: Payment Required',
    403: '403: Forbidden',
    404: '404: Not Found',
    405: '405: Method Not Allowed',
    406: '406: Not Acceptable',
    407: '407: Proxy Authentication Required',
    408: '408: Request Timeout',
    409: '409: Conflict',
    410: '410: Gone',
    411: '411: Length Required',
    412: '412: Precondition Failed',
    413: '413: Request Entity Too Large',
    414: '414: Request-URI Too Long',
    415: '415: Unsupported Media Type',
    416: '416: Requested Range Not Satisfiable',
    417: '417: Expectation Failed',
    418: '418: I\'m a teapot',
    422: '422: Unprocessable Entity',
    423: '423: Locked',
    424: '424: Failed Dependency',
    425: '425: Unordered Collection',
    444: '444: No Response',
    426: '426: Upgrade Required',
    449: '449: Retry With',
    450: '450: Blocked by Windows Parental Controls',
    499: '499: Client Closed Request',
    500: '500: Internal Server Error',
    501: '501: Not Implemented',
    502: '502: Bad Gateway',
    503: '503: Service Unavailable',
    504: '504: Gateway Timeout',
    505: '505: HTTP Version Not Supported',
    506: '506: Variant Also Negotiates',
    507: '507: Insufficient Storage',
    509: '509: Bandwidth Limit Exceeded',
    510: '510: Not Extended'
};

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
        };
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

    function expectStatusCode(code, fn) {
        return function (callback) {
            fn(function (err, res, body) {
                if (err) {
                    return callback(err);
                }
                if (res.statusCode !== code) {
                    return callback(STATUS_MSGS[res.statusCode]);
                }
                return callback(err, res, body);
            });
        };
    }

    function dbName(name) {
        return options.app_id + '/' + name;
    }

    return {
        databases: {
            add: function (name, callback) {
                var dburl = '/' + encodeURIComponent(dbName(name));

                async.series([
                    expectStatusCode(201,
                        async.apply(request.put, createOptions({url: dburl}))
                    ),
                    expectStatusCode(200,
                        async.apply(request.put, createOptions({
                            url: dburl + '/_security',
                            body: JSON.stringify({
                                admins: {
                                    names: [],
                                    roles: []
                                },
                                members: {
                                    names: [],
                                    roles: ['_admin']
                                }
                            })
                        }))
                    ),
                    function (cb) {
                        options.queue.publish(options.app_id + '/_db_updates', {
                            dbname: dbName(name),
                            type: 'created'
                        },
                        cb);
                    }
                ],
                function (err, results) {
                    if (err) {
                        // rollback!
                        request.del(createOptions({url: dburl}),
                            function () {
                                return callback(err);
                            }
                        );
                    }
                    return callback(
                        null,          // err
                        results[0][0], // res
                        results[0][1]  // body
                    );
                });
            },
            remove: function (name, callback) {
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
            },
            info: function (name, callback) {
                var opts = {url: '/' + encodeURIComponent(dbName(name))};
                request.get(createOptions(opts), callback);
            },
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
