var PluginAPI = require('../lib/index').PluginAPI,
    utils = require('./lib/utils'),
    async = require('async'),
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
        return callback(err, couch);
    });
};

exports.tearDown = function (callback) {
    this.couch.once('stop', function () {
        callback();
    });
    this.couch.stop();
};

exports['request'] = function (test) {
    var hoodie = new PluginAPI(COUCH);
    hoodie.request('GET', '/', {}, function (err, data, res) {
        if (err) {
            return test.done(err);
        }
        test.equal(data.couchdb, 'Welcome');
        test.done();
    });
};

exports['request as admin'] = function (test) {
    var hoodie = new PluginAPI(COUCH);
    hoodie.request('GET', '/_users/_all_docs', {}, function (err, data, res) {
        if (err) {
            return test.done(err);
        }
        test.equal(res.statusCode, 200);
        test.done();
    });
};

exports['database: add / findAll / remove'] = function (test) {
    var hoodie = new PluginAPI(COUCH);
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

        test.same(a, ['bar', 'foo']);
        test.same(b, ['bar']);
        test.same(c, []);
        test.done();
    });
};

exports['db.add / db.get'] = function (test) {
    var hoodie = new PluginAPI(COUCH);
    hoodie.database.add('foo', function (err, db) {
        if (err) {
            console.log('err1');
            return test.done(err);
        }
        var doc = {
            id: 'asdf',
            title: 'Test Document'
        };
        db.add('mytype', doc, function (err, resp) {
            if (err) {
                console.log('err2');
                return test.done(err);
            }
            test.ok(resp.ok);
            db.find('mytype', 'asdf', function (err, doc2) {
                if (err) {
                    console.log('err3');
                    return test.done(err);
                }
                test.equal(doc2.id, 'asdf');
                test.equal(doc2.type, 'mytype');
                test.equal(doc2.title, 'Test Document');
                test.done();
            });
        });
    });
};
