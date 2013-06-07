var HoodieDB = require('../lib/index'),
    MultiCouch = require('multicouch'),
    child_process = require('child_process'),
    request = require('request'),
    mkdirp = require('mkdirp'),
    rimraf = require('rimraf'),
    async = require('async'),
    _ = require('underscore');


var tests = {};

tests['HoodieDB - validate options'] = function (base_opts) {
    return function (test) {
        var options = {
            db: 'http://bar:baz@foo',
            app_id: 'id1234',
            users_db: '_users'
        };
        // no errors on complete options object
        HoodieDB(options, function (err, hoodie) {
            test.ok(!err);
            // missing any one options causes an error
            function testWithout(prop, cb) {
                var opt = JSON.parse(JSON.stringify(options));
                delete opt[prop];
                HoodieDB(opt, function (err, hoodie) {
                    test.ok(err);
                    cb();
                });
            }
            async.each(Object.keys(options), testWithout, function (err) {
                if (err) {
                    return test.done(err);
                }
                // passing no options causes error
                HoodieDB(null, function (err) {
                    test.ok(err);
                    // invalid backend causes error
                    var opts = _.extend(options, {db: 'foo://bar'});
                    HoodieDB(opts, function (err) {
                        test.ok(err);
                        test.done();
                    });
                });
            });
        });
    };
};

tests['databases.add'] = function (base_opts) {
    return function (test) {
        test.expect(1);
        HoodieDB(base_opts, function (err, hoodie) {
            if (err) {
                return test.done(err);
            }
            hoodie.databases.add('foo', function (err) {
                if (err) {
                    return test.done(err);
                }
                hoodie.databases.info('foo', function (err, response) {
                    if (err) {
                        return test.done(err);
                    }
                    test.ok(/foo$/.test(response.db_name));
                    hoodie.databases.remove('foo', test.done);
                });
            });
        });
    };
};

tests['databases.remove'] = function (base_opts) {
    return function (test) {
        test.expect(2);
        HoodieDB(base_opts, function (err, hoodie) {
            if (err) {
                return test.done(err);
            }
            hoodie.databases.add('foo', function (err) {
                if (err) {
                    return test.done(err);
                }
                hoodie.databases.list(function (err, dbs) {
                    if (err) {
                        return test.done(err);
                    }
                    test.ok(_.contains(dbs, 'foo'));
                    hoodie.databases.remove('foo', function (err) {
                        if (err) {
                            return test.done(err);
                        }
                        hoodie.databases.list(function (err, dbs) {
                            if (err) {
                                return test.done(err);
                            }
                            test.ok(!_.contains(dbs, 'foo'));
                            test.done();
                        });
                    });
                });
            });
        });
    };
};

tests['databases.info'] = function (base_opts) {
    return function (test) {
        test.expect(1);
        HoodieDB(base_opts, function (err, hoodie) {
            if (err) {
                return test.done(err);
            }
            hoodie.databases.add('bar', function (err) {
                if (err) {
                    return test.done(err);
                }
                hoodie.databases.info('bar', function (err, response) {
                    if (err) {
                        return test.done(err);
                    }
                    test.ok(/bar$/.test(response.db_name));
                    hoodie.databases.remove('bar', test.done);
                });
            });
        });
    };
};

tests['databases.list'] = function (base_opts) {
    return function (test) {
        test.expect(2);
        HoodieDB(base_opts, function (err, hoodie) {
            if (err) {
                return test.done(err);
            }
            hoodie.databases.list(function (err, response) {
                if (err) {
                    return test.done(err);
                }
                test.same(response, []);
                hoodie.databases.add('foo', function (err, response) {
                    if (err) {
                        return test.done(err);
                    }
                    hoodie.databases.list(function (err, response) {
                        if (err) {
                            return test.done(err);
                        }
                        test.same(response, ['foo']);
                        hoodie.databases.remove('foo', test.done);
                    });
                });
            });
        });
    };
};

tests['docs.all'] = function (base_opts) {
    return function (test) {
        HoodieDB(base_opts, function (err, hoodie) {
            if (err) {
                return test.done(err);
            }
            var doc = {
                _id: 'abc123',
                title: 'bar'
            };
            async.series([
                async.apply(hoodie.databases.add, 'foo'),
                async.apply(hoodie.docs.all, 'foo'),
                async.apply(hoodie.docs.save, 'foo', doc),
                async.apply(hoodie.docs.all, 'foo')
            ],
            function (err, results) {
                if (err) {
                    return test.done(err);
                }
                var res1 = results[1];
                if (Array.isArray(res1)) {
                    res1 = res1[0];
                }
                var res2 = results[2];
                if (Array.isArray(res2)) {
                    res2 = res2[0];
                }
                var res3 = results[3];
                if (Array.isArray(res3)) {
                    res3 = res3[0];
                }
                test.equal(res1.total_rows, 0);
                test.same(res1.rows, []);
                test.equal(res3.total_rows, 1);
                test.equal(res3.rows.length, 1);
                test.equal(res3.rows[0].id, 'abc123');
                hoodie.docs.remove('foo', {
                    _id: 'abc123',
                    _rev: res2.rev
                },
                test.done);
                // TODO: test options for all_docs, eg include_docs: true
            });
        });
    };
};

tests['docs.save'] = function (base_opts) {
    return function (test) {
        HoodieDB(base_opts, function (err, hoodie) {
            if (err) {
                return test.done(err);
            }
            var doc = {
                _id: 'abc123',
                title: 'bar'
            };
            async.series([
                async.apply(hoodie.databases.add, 'foo'),
                async.apply(hoodie.docs.all, 'foo'),
                async.apply(hoodie.docs.save, 'foo', doc),
                async.apply(hoodie.docs.all, 'foo')
            ],
            function (err, results) {
                if (err) {
                    return test.done(err);
                }
                var res1 = results[1];
                if (Array.isArray(res1)) {
                    res1 = res1[0];
                }
                var res2 = results[2];
                if (Array.isArray(res2)) {
                    res2 = res2[0];
                }
                var res3 = results[3];
                if (Array.isArray(res3)) {
                    res3 = res3[0];
                }
                test.equal(res1.total_rows, 0);
                test.same(res1.rows, []);
                test.equal(res3.total_rows, 1);
                test.equal(res3.rows.length, 1);
                test.equal(res3.rows[0].id, 'abc123');
                hoodie.docs.remove('foo', {
                    _id: 'abc123',
                    _rev: res2.rev
                },
                test.done);
            });
        });
    };
};

tests['docs.get'] = function (base_opts) {
    return function (test) {
        test.expect(2);
        HoodieDB(base_opts, function (err, hoodie) {
            if (err) {
                return test.done(err);
            }
            var doc = {
                _id: 'abc123',
                title: 'bar'
            };
            async.series([
                async.apply(hoodie.databases.add, 'foo'),
                async.apply(hoodie.docs.save, 'foo', doc),
                async.apply(hoodie.docs.get, 'foo', 'abc123')
            ],
            function (err, results) {
                if (err) {
                    return test.done(err);
                }
                var res1 = results[1];
                if (Array.isArray(res1)) {
                    res1 = res1[0];
                }
                var doc2 = results[2];
                if (Array.isArray(doc2)) {
                    doc2 = doc2[0];
                }
                test.equal(doc2.title, doc.title);
                test.ok(doc2._rev);
                hoodie.docs.remove('foo', {
                    _id: 'abc123',
                    _rev: res1.rev
                },
                test.done);
            });
        });
    };
};

tests['docs.remove'] = function (base_opts) {
    return function (test) {
        HoodieDB(base_opts, function (err, hoodie) {
            if (err) {
                return test.done(err);
            }
            var doc = {
                _id: 'abc123',
                title: 'bar'
            };
            async.series([
                async.apply(hoodie.databases.add, 'foo'),
                async.apply(hoodie.docs.save, 'foo', doc),
                async.apply(hoodie.docs.all, 'foo')
            ],
            function (err, results) {
                if (err) {
                    return test.done(err);
                }
                var res1 = results[2];
                if (Array.isArray(res1)) {
                    res1 = res1[0];
                }
                test.equal(res1.total_rows, 1);
                test.equal(res1.rows.length, 1);
                test.equal(res1.rows[0].id, 'abc123');

                hoodie.docs.get('foo', 'abc123', function (err, doc) {
                    if (err) {
                        return callback(err);
                    }
                    async.series([
                        async.apply(hoodie.docs.remove, 'foo', doc),
                        async.apply(hoodie.docs.all, 'foo')
                    ],
                    function (err, results) {
                        var res2 = results[1];
                        if (Array.isArray(res2)) {
                            res2 = res2[0];
                        }
                        test.equal(res2.total_rows, 0);
                        test.same(res2.rows, []);
                        test.done();
                    });
                });
            });
        });
    };
};

tests['docs.changes'] = function (base_opts) {
    return function (test) {
        HoodieDB(base_opts, function (err, hoodie) {
            if (err) {
                return test.done(err);
            }
            hoodie.databases.add('foo', function (err) {
                if (err) {
                    return callback(err);
                }
                hoodie.databases.info('foo', function (err, info) {
                    if (err) {
                        return callback(err);
                    }
                    var changes = [];
                    var opts = {
                        include_docs: true,
                        continuous: true,
                        since: info.update_seq,
                        onChange: function (change) {
                            changes.push(change);
                        }
                    };
                    hoodie.docs.changes('foo', opts, function (err, feed) {
                        var doc = {
                            _id: 'asdfasdf',
                            title: 'bar'
                        };
                        // create
                        hoodie.docs.save('foo', doc, function (err, data) {
                            if (err) {
                                return test.done(err);
                            }
                            doc._rev = data.rev;
                            // delete
                            hoodie.docs.remove('foo', doc, function (err) {
                                if (err) {
                                    return test.done(err);
                                }
                                // give the changes feed time to reconnect
                                setTimeout(function () {
                                    test.equal(changes.length, 2);
                                    test.equal(changes[0].id, doc._id);
                                    test.equal(changes[0].doc.title, 'bar');
                                    test.equal(changes[1].id, doc._id);
                                    test.equal(changes[1].doc._deleted, true);
                                    feed.cancel();
                                    test.done();
                                }, 100);
                            });
                        });
                    });
                });
            });
        });
    };
};

tests['users.add, users.remove, users.get'] = function (base_opts) {
    return function (test) {
        HoodieDB(base_opts, function (err, hoodie) {
            if (err) {
                return test.done(err);
            }
            hoodie.users.add('foobar', 'secret', function (err, res) {
                if (err) {
                    return test.done(err);
                }
                hoodie.users.get('foobar', function (err, doc) {
                    if (err) {
                        return test.done(err);
                    }
                    // TODO: why doesn't doc._rev get set? Pouch reports
                    // a conflict on the console but doesn't return it as an
                    // error to the callback
                    test.equal(doc._rev, res.rev);
                    test.done();
                });
            });
            /*
            async.series([
                async.apply(hoodie.databases.add, 'foo'),
                async.apply(hoodie.users.add, 'foobar', 'secret'),
                async.apply(hoodie.users.get, 'foobar')
            ],
            function (err, results) {
                console.log('cb');
                if (err) {
                    console.log(['err', err]);
                    return test.done(err);
                }
                // should be user doc
                var res2 = results[2];
                if (Array.isArray(res2)) {
                    res2 = res2[0];
                }
                var doc;
                if (res2 instanceof Buffer) {
                    doc = JSON.parse(res2.toString());
                }
                else {
                    doc = res2;
                }
                console.log(['doc', doc]);
                test.equal(doc.name, 'user/foobar');
                hoodie.users.remove(doc, function (err) {
                    if (err) {
                        return test.done(err);
                    }
                    hoodie.users.get('foobar', function (err, doc) {
                        // should return error, user has been removed
                        test.ok(err);
                        test.done();
                    });
                });
            });
            */
        });
    };
};



// make CouchDB tests

var USER = 'admin';
var PASS = 'password';
var COUCH_PORT = 8985;
var COUCH_BASE_URL = 'http://localhost:' + COUCH_PORT;
var COUCH_URL = 'http://' + USER + ':' + PASS + '@localhost:' + COUCH_PORT;

var waiting = [];
var couch_state = 'stopped';
var couch = null;

function withCouch(callback) {
    if (couch_state === 'started') {
        return callback(null, couch);
    }
    else if (couch_state === 'starting') {
        waiting.push(callback);
    }
    else {
        couch_state = 'starting';
        waiting.push(callback);

        var data_dir = __dirname + '/data';

        console.log('Killing any old CouchDB instances');
        var cmd = 'pkill -fu ' + process.env.LOGNAME + ' ' + data_dir;

        child_process.exec(cmd, function (err, stdout, stderr) {

            console.log('Starting CouchDB...\n');
            var that = this;

            async.series([
                async.apply(rimraf, data_dir),
                async.apply(mkdirp, data_dir),
                async.apply(startCouch, data_dir),
                async.apply(createAdmin, USER, PASS)
            ],
            function (err) {
                if (err) {
                    return callback(err);
                }
                process.on('exit', function (code) {
                    console.log('Stopping CouchDB...');
                    couch.once('stop', function () {
                        process.exit(code);
                    });
                    couch.stop();
                });
                couch_state = 'started';
                waiting.forEach(function (cb) {
                    cb(null, couch);
                });
                waiting = [];
            });
        });
    }
}

function startCouch(data_dir, callback) {
    // MultiCouch config object
    var couch_cfg = {
        port: COUCH_PORT,
        prefix: data_dir,
        couchdb_path: '/usr/bin/couchdb',
        default_sys_ini: '/etc/couchdb/default.ini',
        respawn: false // otherwise causes problems shutting down
    };
    // starts a local couchdb server using the Hoodie app's data dir
    var couchdb = new MultiCouch(couch_cfg);
    // local couchdb has started
    couchdb.on('start', function () {
        // give it time to be ready for requests
        pollCouch(couchdb, function (err) {
            if (err) {
                return callback(err);
            }
            couch = couchdb;
            return callback();
        });
    });
    couchdb.on('error', callback);
    couchdb.start();
}

function createAdmin(name, pass, callback) {
    request({
        url: COUCH_BASE_URL + '/_config/admins/' + name,
        method: 'PUT',
        body: JSON.stringify(pass)
    }, callback);
}

function pollCouch(couchdb, callback) {
    function _poll() {
        var opts = {
            url: COUCH_BASE_URL + '/_all_dbs',
            json: true
        };
        request(opts, function (err, res, body) {
            if (res && res.statusCode === 200 && body.length === 2) {
                return callback(null, couchdb);
            }
            else {
                // wait and try again
                return setTimeout(_poll, 100);
            }
        });
    }
    // start polling
    _poll();
}

var couchdb_base_opts = {
    db: COUCH_URL,
    app_id: 'id1234',
    users_db: '_users',
    queue: {
        publish: function (name, body, callback) {
            return callback();
        }
    }
};

exports.couchdb = {};
Object.keys(tests).forEach(function (name) {
    exports.couchdb[name] = function (test) {
        withCouch(function (err, couch) {
            if (err) {
                return test.done(err);
            }
            tests[name](couchdb_base_opts)(test);
        });
    };
});

var pouchdb_base_opts = {
    db: 'leveldb://' + __dirname + '/data/pouch',
    app_id: 'id1234',
    users_db: '_users',
    queue: {
        publish: function (name, body, callback) {
            return callback();
        }
    }
};

exports.pouchdb = {};
Object.keys(tests).forEach(function (name) {
    exports.pouchdb[name] = tests[name](pouchdb_base_opts);
});
