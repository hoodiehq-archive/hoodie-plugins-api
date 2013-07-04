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
    var database = hoodie.database;
    async.series([
        async.apply(_.bind(database.add, database), 'foo'),
        async.apply(_.bind(database.add, database), 'bar'),
        _.bind(database.findAll, database),
        async.apply(_.bind(database.remove, database), 'foo'),
        _.bind(database.findAll, database),
        async.apply(_.bind(database.remove, database), 'bar'),
        _.bind(database.findAll, database),
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
