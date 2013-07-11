var PluginAPI = require('../lib/index').PluginAPI,
    couchr = require('couchr'),
    utils = require('./lib/utils'),
    async = require('async'),
    url = require('url'),
    _ = require('underscore');


var COUCH = {
    user: 'admin',
    pass: 'password',
    url: 'http://localhost:8985',
    data_dir: __dirname + '/data',
};

var DEFAULT_OPTIONS = {
    name: 'myplugin',
    couchdb: COUCH,
    config: {
        app: {foo: 'bar'},
        plugin: {}
    }
};

exports.setUp = function (callback) {
    var that = this;
    utils.setupCouch(COUCH, function (err, couch) {
        that.couch = couch;

        var base = url.parse(COUCH.url);
        base.auth = COUCH.user + ':' + COUCH.pass;
        base = url.format(base);

        var appconfig = {
            config: {foo: 'bar'}
        };
        async.series([
            async.apply(couchr.put, url.resolve(base, 'plugins')),
            async.apply(couchr.put, url.resolve(base, 'app')),
            async.apply(couchr.put, url.resolve(base, 'app/config'), appconfig)
        ],
        callback);
    });
};

exports.tearDown = function (callback) {
    this.couch.once('stop', function () {
        callback();
    });
    this.couch.stop();
};

exports['request'] = function (test) {
    var hoodie = new PluginAPI(DEFAULT_OPTIONS);
    hoodie.request('GET', '/', {}, function (err, data, res) {
        if (err) {
            return test.done(err);
        }
        test.equal(data.couchdb, 'Welcome');
        test.done();
    });
};

exports['request as admin'] = function (test) {
    var hoodie = new PluginAPI(DEFAULT_OPTIONS);
    hoodie.request('GET', '/_users/_all_docs', {}, function (err, data, res) {
        if (err) {
            return test.done(err);
        }
        test.equal(res.statusCode, 200);
        test.done();
    });
};

exports['database: add / findAll / remove'] = function (test) {
    var hoodie = new PluginAPI(DEFAULT_OPTIONS);
    async.series([
        async.apply(hoodie.database.add, 'foo'),
        async.apply(hoodie.database.add, 'bar'),
        hoodie.database.findAll,
        async.apply(hoodie.database.remove, 'foo'),
        hoodie.database.findAll,
        async.apply(hoodie.database.remove, 'bar'),
        hoodie.database.findAll,
    ],
    function (err, results) {
        var a = results[2][0],
            b = results[4][0],
            c = results[6][0];

        test.same(a, ['app', 'bar', 'foo', 'plugins']);
        test.same(b, ['app', 'bar', 'plugins']);
        test.same(c, ['app', 'plugins']);
        test.done();
    });
};

exports['database: get by name'] = function (test) {
    var hoodie = new PluginAPI(DEFAULT_OPTIONS);
    hoodie.database.add('wibble', function (err, db) {
        if (err) {
            return test.done(err);
        }
        var db2 = hoodie.database('wibble');
        test.equal(db._resolve('wobble'), db2._resolve('wobble'));
        test.done();
    });
};

exports['db.add / db.get / db.update / db.get'] = function (test) {
    var hoodie = new PluginAPI(DEFAULT_OPTIONS);
    hoodie.database.add('foo', function (err, db) {
        if (err) {
            return test.done(err);
        }
        var doc = {
            id: 'asdf',
            title: 'Test Document'
        };
        async.series([
            function (cb) {
                db.add('mytype', doc, function (err, resp) {
                    if (err) {
                        return cb(err);
                    }
                    test.ok(resp.ok);
                    return cb();
                });
            },
            function (cb) {
                db.find('mytype', 'asdf', function (err, doc) {
                    if (err) {
                        return cb(err);
                    }
                    test.equal(doc.id, 'asdf');
                    test.equal(doc.type, 'mytype');
                    test.equal(doc.title, 'Test Document');
                    return cb();
                });
            },
            function (cb) {
                db.update('mytype', 'asdf', {foo: 'bar'}, cb);
            },
            function (cb) {
                db.find('mytype', 'asdf', function (err, doc) {
                   if (err) {
                       return cb(err);
                   }
                   test.equal(doc.id, 'asdf');
                   test.equal(doc.type, 'mytype');
                   test.equal(doc.title, 'Test Document');
                   test.equal(doc.foo, 'bar');
                   return cb();
                });
            }
        ],
        test.done);
    });
};

exports['db.add / db.findAll'] = function (test) {
    var hoodie = new PluginAPI(DEFAULT_OPTIONS);
    hoodie.database.add('foo', function (err, db) {
        if (err) {
            return test.done(err);
        }
        var doc1 = {id: 'wibble', title: 'Test Document 1'};
        var doc2 = {id: 'wobble', title: 'Test Document 2'};
        async.parallel([
            async.apply(db.add, 'mytype', doc1),
            async.apply(db.add, 'mytype', doc2)
        ],
        function (err) {
            if (err) {
                return test.done(err);
            }
            db.findAll(function (err, docs) {
                if (err) {
                    return test.done(err);
                }
                test.equal(docs.length, 2);
                test.equal(docs[0].id, 'wibble');
                test.equal(docs[0].type, 'mytype');
                test.equal(docs[0].title, 'Test Document 1');
                test.equal(docs[1].id, 'wobble');
                test.equal(docs[1].type, 'mytype');
                test.equal(docs[1].title, 'Test Document 2');
                test.done();
            });
        });
    });
};

exports['db.add / db.findAll of type'] = function (test) {
    var hoodie = new PluginAPI(DEFAULT_OPTIONS);
    hoodie.database.add('foo', function (err, db) {
        if (err) {
            return test.done(err);
        }
        var doc1 = {id: 'wibble', title: 'Test Document 1'};
        var doc2 = {id: 'wobble', title: 'Test Document 2'};
        var doc3 = {id: 'wubble', title: 'Test Document 3'};
        async.parallel([
            async.apply(db.add, 'mytype', doc1),
            async.apply(db.add, 'mytype', doc2),
            async.apply(db.add, 'othertype', doc3)
        ],
        function (err) {
            if (err) {
                return test.done(err);
            }
            db.findAll('othertype', function (err, docs) {
                if (err) {
                    return test.done(err);
                }
                test.equal(docs.length, 1);
                test.equal(docs[0].id, 'wubble');
                test.equal(docs[0].type, 'othertype');
                test.equal(docs[0].title, 'Test Document 3');
                test.done();
            });
        });
    });
};

exports['db.add / db.findAll / db.remove / db.findAll'] = function (test) {
    var hoodie = new PluginAPI(DEFAULT_OPTIONS);
    hoodie.database.add('foo', function (err, db) {
        if (err) {
            return test.done(err);
        }
        async.series([
            async.apply(db.add, 'mytype', {id: 'wibble', title: 'Test'}),
            db.findAll,
            async.apply(db.remove, 'mytype', 'wibble'),
            db.findAll
        ],
        function (err, results) {
            if (err) {
                return test.done(err);
            }
            test.equal(results[1].length, 1);
            test.equal(results[1][0].id, 'wibble');
            test.equal(results[3].length, 0);
            test.done();
        });
    });
};

exports['db.add / db.findAll / db.removeAll / db.findAll'] = function (test) {
    var hoodie = new PluginAPI(DEFAULT_OPTIONS);
    hoodie.database.add('foo', function (err, db) {
        if (err) {
            return test.done(err);
        }
        async.series([
            async.apply(db.add, 'type1', {id: 'wibble'}),
            async.apply(db.add, 'type1', {id: 'wobble'}),
            async.apply(db.add, 'type2', {id: 'wubble'}),
            db.findAll,
            async.apply(db.removeAll, 'type1'),
            db.findAll
        ],
        function (err, results) {
            if (err) {
                return test.done(err);
            }
            test.equal(results[3].length, 3);
            test.equal(results[3][0].id, 'wibble');
            test.equal(results[3][1].id, 'wobble');
            test.equal(results[3][2].id, 'wubble');
            test.equal(results[5].length, 1);
            test.equal(results[5][0].id, 'wubble');
            test.done();
        });
    });
};

exports['config.set / config.get'] = function (test) {
    var hoodie = new PluginAPI(DEFAULT_OPTIONS);
    var hoodie2 = new PluginAPI({
        name: 'otherplugin',
        couchdb: COUCH,
        config: DEFAULT_OPTIONS.config
    });

    // try getting a property that does not exist
    test.strictEqual(hoodie.config.get('asdf'), undefined);

    // set then immediately read a property
    hoodie.config.set('asdf', 123);
    test.equal(hoodie.config.get('asdf'), 123);

    // read global config
    test.equal(hoodie.config.get('foo'), 'bar');

    // override global config value for single plugin only
    hoodie.config.set('foo', 'baz');
    test.equal(hoodie.config.get('foo'), 'baz');
    test.equal(hoodie2.config.get('foo'), 'bar');

    // make sure the config is persistent
    setTimeout(function () {
        var myplugin_url = hoodie._resolve('plugins/plugin%2Fmyplugin');
        var otherplugin_url = hoodie._resolve('plugins/plugin%2Fotherplugin');

        couchr.get(myplugin_url, function (err, doc) {
            if (err) {
                return test.done(err);
            }
            test.equal(doc.config.foo, 'baz');
            couchr.get(otherplugin_url, function (err, doc2) {
                test.same(err.error, 'not_found');
                test.done();
            });
        });
    }, 1000);
};

exports['update config from couch'] = function (test) {
    var hoodie = new PluginAPI(DEFAULT_OPTIONS);
    test.strictEqual(hoodie.config.get('asdf'), undefined);
    hoodie.config._updateAppConfig({asdf: 1234});
    test.equal(hoodie.config.get('asdf'), 1234);
    hoodie.config._updatePluginConfig({asdf: 5678});
    test.equal(hoodie.config.get('asdf'), 5678);
    test.done();
};

exports['user.add / findAll / get / remove / update'] = function (test) {
    var hoodie = new PluginAPI(DEFAULT_OPTIONS);
    async.series([
        hoodie.user.findAll,
        async.apply(hoodie.user.add, 'testuser', 'testing'),
        hoodie.user.findAll,
        hoodie.user('testuser').get,
        async.apply(hoodie.user('testuser').update, {wibble: 'wobble'}),
        hoodie.user('testuser').get,
        hoodie.user('testuser').remove,
        hoodie.user.findAll
    ],
    function (err, results) {
        if (err) {
            return test.done(err);
        }
        var docs1 = results[0];
        var docs2 = results[2];
        var userdoc1 = results[3][0];
        var userdoc2 = results[5][0];
        var docs3 = results[7];
        test.equal(docs1.length, 0);
        test.equal(docs2.length, 1);
        test.equal(docs2[0].name, 'testuser');
        test.equal(userdoc1.name, 'testuser');
        test.equal(userdoc2.wibble, 'wobble');
        test.equal(docs3.length, 0);
        test.done();
    });
};

exports['pass through user events from plugin manager'] = function (test) {
    var hoodie = new PluginAPI(DEFAULT_OPTIONS);
    var user_events = [];
    hoodie.user.on('add', function (doc) {
        user_events.push('add ' + doc.name);
    });
    hoodie.user.on('update', function (doc) {
        user_events.push('update ' + doc.name);
    });
    hoodie.user.on('remove', function (doc) {
        user_events.push('remove ' + doc.name);
    });
    hoodie.user.on('change', function (doc) {
        user_events.push('change ' + doc.name);
    });
    hoodie.user.emit('add', {name: 'testuser'});
    hoodie.user.emit('update', {name: 'testuser'});
    hoodie.user.emit('remove', {name: 'testuser'});
    hoodie.user.emit('change', {name: 'testuser'});
    test.same(user_events, [
        'add testuser',
        'update testuser',
        'remove testuser',
        'change testuser'
    ]);
    test.done();
};

exports['pass through task events'] = function (test) {
    var hoodie = new PluginAPI(DEFAULT_OPTIONS);
    var evs = [];
    hoodie.task('mytask').on('add', function (doc) {
        evs.push('add ' + doc.name);
    });
    hoodie.task('mytask').on('update', function (doc) {
        evs.push('update ' + doc.name);
    });
    hoodie.task('mytask').on('remove', function (doc) {
        evs.push('remove ' + doc.name);
    });
    hoodie.task('mytask').on('change', function (doc) {
        evs.push('change ' + doc.name);
    });
    hoodie.task('mytask').emit('add', {name: 'test'});
    hoodie.task('mytask').emit('update', {name: 'test'});
    hoodie.task('mytask').emit('remove', {name: 'test'});
    hoodie.task('mytask').emit('change', {name: 'test'});
    hoodie.task('othertask').emit('add', {name: 'test2'});
    test.same(evs, [
        'add test',
        'update test',
        'remove test',
        'change test'
        // othertask doesn't get added
    ]);
    test.done();
};

exports['new databases are only accessible to _admin users'] = function (test) {
    var hoodie = new PluginAPI(DEFAULT_OPTIONS);
    hoodie.database.add('foo', function (err, db) {
        if (err) {
            return test.done(err);
        }
        couchr.get(COUCH.url + '/foo/_all_docs', function (err, body, res) {
            test.equal(res.statusCode, 401);
            test.done();
        });
    });
};

exports['db.grantWriteAccess / db.revokeWriteAccess'] = function (test) {
    var hoodie = new PluginAPI(DEFAULT_OPTIONS);

    var db_url = url.parse(COUCH.url + '/foo');
    db_url.auth = 'testuser:testing';
    db_url = url.format(db_url);

    hoodie.database.add('foo', function (err, db) {
        if (err) {
            return test.done(err);
        }
        var ignoreErrs = function (fn) {
            return function (callback) {
                fn(function () {
                    var args = Array.prototype.slice.call(arguments, 1);
                    return callback.apply(this, [null].concat(args));
                });
            }
        };
        var user_url = '/_users/org.couchdb.user%3Atestuser';
        var tasks = [
            async.apply(hoodie.user.add, 'testuser', 'testing'),
            async.apply(couchr.get, db_url + '/_all_docs'),
            async.apply(db.grantWriteAccess, 'testuser'),
            async.apply(couchr.get, db_url + '/_all_docs'),
            async.apply(couchr.put, db_url + '/some_doc', {data: {asdf: 123}}),
            async.apply(db.revokeWriteAccess, 'testuser'),
            async.apply(couchr.get, db_url + '/_all_docs'),
            async.apply(couchr.put, db_url + '/some_doc2', {data: {asdf: 123}})
        ];
        async.series(tasks.map(ignoreErrs), function (err, results) {
            test.equal(results[1][1].statusCode, 401);
            test.equal(results[3][1].statusCode, 200);
            test.equal(results[4][1].statusCode, 201);
            // after revoke - cannot write but can still read!
            test.equal(results[6][1].statusCode, 200);
            test.equal(results[7][1].statusCode, 401);
            test.done();
        });
    });
};
