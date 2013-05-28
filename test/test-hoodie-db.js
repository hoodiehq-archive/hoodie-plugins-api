var hdb = require('../lib/hoodie-db'),
    MultiCouch = require('multicouch'),
    child_process = require('child_process'),
    //Pouch = require('pouchdb'),
    request = require('request'),
    mkdirp = require('mkdirp'),
    rimraf = require('rimraf'),
    async = require('async'),
    _ = require('underscore');


var tests = {};

tests['createClient - validate options'] = function (base_opts) {
    return function (test) {
        var options = {
            db: 'http://bar:baz@foo',
            app_id: 'id1234',
            admins: '_users',
            queue: {}
        };
        // no errors on complete options object
        test.doesNotThrow(function () {
            hdb.createClient(options);
        });
        // missing any one options causes an error
        function testWithout(prop) {
            var opt = JSON.parse(JSON.stringify(options));
            delete opt[prop];
            test.throws(function () {
                hdb.createClient(opt);
            },
            new RegExp(prop));
        }
        for (var k in options) {
            testWithout(k);
        }
        // passing no options causes error
        test.throws(function () { hdb.createClient(); });
        test.done();
    };
};

tests['databases.add'] = function (base_opts) {
    return function (test) {
        test.expect(3);
        var q = {
            publish: function (queue, body, callback) {
                test.equal(queue, 'id1234/_db_updates');
                test.same(body, {
                    dbname: 'id1234/foo',
                    type: 'created'
                });
                return callback();
            }
        };
        var hoodie = hdb.createClient(_.extend(base_opts, {
            queue: q
        }));
        hoodie.databases.add('foo', function (err) {
            if (err) {
                return test.done(err);
            }
            var db = Pouch(
                base_opts.db + '/' + encodeURIComponent('id1234/foo')
            );
            db.info(function (err, response) {
                if (err) {
                    return test.done(err);
                }
                test.equals(response.db_name, 'id1234/foo');
                test.done();
            });
        });
    };
};

tests['databases.remove'] = function (base_opts) {
    return function (test) {
        test.expect(4);
        var q = {
            publish: function (queue, body, callback) {
                if (body.type === 'created') {
                    // ignore first created event
                    return callback();
                }
                test.equal(queue, 'id1234/_db_updates');
                test.same(body, {
                    dbname: 'id1234/foo',
                    type: 'deleted'
                });
                return callback();
            }
        };
        var hoodie = hdb.createClient(_.extend(base_opts, {
            queue: q
        }));
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
                        console.log(['got error', arguments]);
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
    };
};

tests['databases.info'] = function (base_opts) {
    return function (test) {
        test.expect(1);
        var hoodie = hdb.createClient(base_opts);
        hoodie.databases.add('bar', function (err) {
            if (err) {
                return test.done(err);
            }
            hoodie.databases.info('bar', function (err, response) {
                if (err) {
                    return test.done(err);
                }
                test.equal(response.db_name, 'id1234/bar');
                hoodie.databases.remove('bar', function (err) {
                    test.done();
                });
            });
        });
    };
};

tests['databases.list'] = function (base_opts) {
    return function (test) {
        test.expect(2);
        var hoodie = hdb.createClient(base_opts);
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
                    test.done();
                });
            });
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
            couch = couchdb
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
};

var couchdb_base_opts = {
    db: COUCH_URL,
    app_id: 'id1234',
    admins: '_users',
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
