var hoodiedb = require('../lib/hoodie-db'),
    MultiCouch = require('multicouch'),
    request = require('request'),
    mkdirp = require('mkdirp'),
    rimraf = require('rimraf'),
    async = require('async');


exports['validate options'] = function (test) {
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
        hoodiedb(options);
    });
    // missing any one options causes an error
    function testWithout(prop) {
        var opt = JSON.parse(JSON.stringify(options));
        delete opt[prop];
        test.throws(function () { hoodiedb(opt); }, new RegExp(prop));
    }
    for (var k in options) {
        testWithout(k);
    }
    // passing no options causes error
    test.throws(function () { hoodiedb(); });
    test.done();
};


var COUCH_PORT = 8984;
var COUCH_URL = 'http://localhost:' + COUCH_PORT;
var USER = 'admin';
var PASS = 'password';

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
        pollCouch(couchdb, callback);
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

exports.integration = {
    setUp: function (callback) {
        var data_dir = __dirname + '/data';
        var that = this;

        rimraf(data_dir, function (err) {
            if (err) {
                return callback(err);
            }
            mkdirp(data_dir, function (err) {
                if (err) {
                    return callback(err);
                }
                startCouch(data_dir, function (err, couchdb) {
                    if (err) {
                        return callback(err);
                    }
                    that.couchdb = couchdb;
                    createAdmin(USER, PASS, callback);
                });
            });
        });

    },
    tearDown: function (callback) {
        this.couchdb.once('stop', callback);
        this.couchdb.stop();
    }
};

exports.integration['createDatabase'] = function (test) {
    var hdb = hoodiedb({
        url: COUCH_URL,
        user: USER,
        pass: PASS,
        app_id: 'id1234',
        admin_db: '_users',
        queue: {}
    });
    hdb.createDatabase('foo', function (err) {
        if (err) {
            return test.done(err);
        }
        var dburl = COUCH_URL + '/' + encodeURIComponent('id1234/foo');
        request(dburl, {json: true}, function (err, res, body) {
            if (err) {
                return test.done(err);
            }
            test.equals(res.statusCode, 200);
            test.done();
        });
    });
};

exports.integration['deleteDatabase'] = function (test) {
    test.expect(2);

    var hdb = hoodiedb({
        url: COUCH_URL,
        user: USER,
        pass: PASS,
        app_id: 'id1234',
        admin_db: '_users',
        queue: {}
    });

    var dburl = COUCH_URL + '/' + encodeURIComponent('id1234/foo');

    async.series([
        async.apply(hdb.createDatabase, 'foo'),
        function (cb) {
            request(dburl, {json: true}, function (err, res, body) {
                if (err) {
                    return cb(err);
                }
                test.equals(res.statusCode, 200);
                cb();
            });
        },
        async.apply(hdb.deleteDatabase, 'foo'),
        function (cb) {
            request(dburl, {json: true}, function (err, res, body) {
                if (err) {
                    return cb(err);
                }
                test.equals(res.statusCode, 404);
                cb();
            });
        }
    ], test.done);
};

exports.integration['createDatabase - db_updates queue'] = function (test) {
    test.expect(2);

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

    var hdb = hoodiedb({
        url: COUCH_URL,
        user: USER,
        pass: PASS,
        app_id: 'id1234',
        admin_db: '_users',
        queue: q
    });

    hdb.createDatabase('foo', function (err, res, body) {
        if (err) {
            return test.done(err);
        }
        test.done();
    });
};
