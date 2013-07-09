var createAPI = require('../lib/index').createAPI,
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
        function (err) {
            if (err) {
                return callback(err);
            }
            var options = {
                name: 'myplugin',
                couchdb: COUCH
            };
            createAPI(options, function (err, hoodie) {
                that.hoodie = hoodie;
                return callback(err);
            });
        });
    });
};

exports.tearDown = function (callback) {
    var that = this;
    this.hoodie._stop(function () {
        that.couch.once('stop', function () {
            callback();
        });
        that.couch.stop();
    });
};

exports['request'] = function (test) {
    var hoodie = this.hoodie;
    hoodie.request('GET', '/', {}, function (err, data, res) {
        if (err) {
            return test.done(err);
        }
        test.equal(data.couchdb, 'Welcome');
        test.done();
    });
};

exports['request as admin'] = function (test) {
    var hoodie = this.hoodie;
    hoodie.request('GET', '/_users/_all_docs', {}, function (err, data, res) {
        if (err) {
            return test.done(err);
        }
        test.equal(res.statusCode, 200);
        test.done();
    });
};

exports['database: add / findAll / remove'] = function (test) {
    var hoodie = this.hoodie;
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
    var hoodie = this.hoodie;
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
    var hoodie = this.hoodie;
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
    var hoodie = this.hoodie;
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
    var hoodie = this.hoodie;
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
    var hoodie = this.hoodie;
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
                return callback(err);
            }
            test.equal(results[1].length, 1);
            test.equal(results[1][0].id, 'wibble');
            test.equal(results[3].length, 0);
            test.done();
        });
    });
};

exports['db.add / db.findAll / db.removeAll / db.findAll'] = function (test) {
    var hoodie = this.hoodie;
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
    var hoodie = this.hoodie;
    createAPI({name: 'otherplugin', couchdb: COUCH}, function (err, hoodie2) {
        if (err) {
            return test.done(err);
        }

        var _done = test.done;
        test.done = function () {
            var args = arguments;
            hoodie2._stop(function () {
                return _done.apply(null, args);
            });
        };

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
                    if (err) {
                        return test.done(err);
                    }
                    test.strictEqual(doc2.config.foo, undefined);
                    test.done();
                });
            });
        }, 1000);
    });
};

exports['automatically update plugin config from couch'] = function (test) {
    var hoodie = this.hoodie;
    test.strictEqual(hoodie.config.get('asdf'), undefined);
    var url = hoodie._resolve('plugins/plugin%2Fmyplugin');
    couchr.get(url, function (err, doc) {
        if (err) {
            return test.done(err);
        }
        doc.config.asdf = 12345;
        couchr.put(url, doc, function (err) {
            if (err) {
                return test.done(err);
            }
            // test that couchdb change event causes config to update
            setTimeout(function () {
                test.equal(hoodie.config.get('asdf'), 12345);
                test.done();
            }, 1000);
        });
    });
};

exports['automatically update app config from couch'] = function (test) {
    var hoodie = this.hoodie;
    test.strictEqual(hoodie.config.get('asdf'), undefined);
    var url = hoodie._resolve('app/config');
    couchr.get(url, function (err, doc) {
        if (err) {
            return test.done(err);
        }
        doc.config.asdf = 12345;
        couchr.put(url, doc, function (err) {
            if (err) {
                return test.done(err);
            }
            // test that couchdb change event causes config to update
            setTimeout(function () {
                test.equal(hoodie.config.get('asdf'), 12345);
                test.done();
            }, 1000);
        });
    });
};

exports['user.add / user.list / user.remove'] = function (test) {
    var hoodie = this.hoodie;
    async.series([
        hoodie.user.findAll,
        async.apply(hoodie.user.add, 'testuser', 'testing'),
        hoodie.user.findAll,
        async.apply(hoodie.user.remove, 'testuser'),
        hoodie.user.findAll
    ],
    function (err, results) {
        if (err) {
            return test.done(err);
        }
        var docs1 = results[0];
        var docs2 = results[2];
        var docs3 = results[4];
        test.equal(docs1.length, 0);
        test.equal(docs2.length, 1);
        test.equal(docs2[0].name, 'testuser');
        test.equal(docs3.length, 0);
        test.done();
    });
};
