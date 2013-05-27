var hdb = require('../lib/hoodie-db'),
    MultiCouch = require('multicouch'),
    request = require('request'),
    mkdirp = require('mkdirp'),
    rimraf = require('rimraf'),
    async = require('async'),
    _ = require('underscore');


exports['createClient - validate options'] = function (test) {
    var options = {
        url: 'http://foo',
        user: 'bar',
        pass: 'baz',
        app_id: 'id1234',
        admin_db: '_users',
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




var COUCH_PORT = 8985;
var COUCH_URL = 'http://localhost:' + COUCH_PORT;
var USER = 'admin';
var PASS = 'password';

var COUCH_STARTED = false;
var couch = null;

function withCouch(callback) {
    if (COUCH_STARTED) {
        return callback(null, couch);
    }
    else {
        var data_dir = __dirname + '/data';
        var that = this;

        async.series([
            async.apply(rimraf, data_dir),
            async.apply(mkdirp, data_dir),
            async.apply(startCouch, data_dir),
            async.apply(createAdmin, USER, PASS)
        ],
        function (err) {
            process.on('exit', function (code) {
                couch.once('stop', function () {
                    process.exit(code);
                });
                couch.stop();
            });
            return callback(err, couch);
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
            COUCH_STARTED = true;
            couch = couchdb
            return callback();
        });
    });
    couchdb.on('error', callback);
    couchdb.start();
}

function createAdmin(name, pass, callback) {
    request({
        url: COUCH_URL + '/_config/admins/' + name,
        method: 'PUT',
        body: JSON.stringify(pass)
    }, callback);
}

function pollCouch(couchdb, callback) {
    function _poll() {
        request(COUCH_URL, function (err, res, body) {
            if (res && res.statusCode === 200) {
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


var base_opts = {
    url: COUCH_URL,
    user: USER,
    pass: PASS,
    app_id: 'id1234',
    admin_db: '_users',
    queue: {
        publish: function (name, body, callback) {
            return callback();
        }
    }
};

exports['database.create'] = function (test) {
    withCouch(function (err, couchdb) {
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

        hoodie.databases.create('foo', function (err) {
            if (err) {
                return test.done(err);
            }
            var dburl = COUCH_URL + '/' + encodeURIComponent('id1234/foo');
            var opts = {
                json: true,
                auth: {user: USER, pass: PASS}
            };
            request(dburl, opts, function (err, res, body) {
                if (err) {
                    return test.done(err);
                }
                test.equals(res.statusCode, 200);
                test.done();
            });
        });

    });
};

exports['deleteDatabase'] = function (test) {
    withCouch(function (err, couchdb) {
        test.expect(3);

        var q = {
            publish: function (queue, body, callback) {
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

        hoodie.databases.remove('foo', function (err) {
            if (err) {
                return test.done(err);
            }
            var dburl = COUCH_URL + '/' + encodeURIComponent('id1234/foo');
            var opts = {
                json: true,
                auth: {user: USER, pass: PASS}
            };
            request(dburl, function (err, res, body) {
                if (err) {
                    return test.done(err);
                }
                test.equals(res.statusCode, 404);
                test.done();
            });
        });

    });
};

exports['only _admins can access created dbs'] = function (test) {
    test.expect(1);

    var hoodie = hdb.createClient(base_opts);
    hoodie.databases.create('bar', function (err, res, body) {
        if (err) {
            return test.done(err);
        }
        var dburl = COUCH_URL + '/' + encodeURIComponent('id1234/bar');
        request(dburl + '/_all_docs', {json: true}, function (err, res, body) {
            if (err) {
                return test.done(err);
            }
            test.equals(res.statusCode, 401);
            test.done();
        });
    });
};
