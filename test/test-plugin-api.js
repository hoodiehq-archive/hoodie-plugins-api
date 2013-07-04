var PluginAPI = require('../lib/index').PluginAPI,
    utils = require('./lib/utils');


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
    var api = new PluginAPI(COUCH);
    api.request('GET', '/', {}, function (err, data, res) {
        if (err) {
            return test.done(err);
        }
        test.equal(data.couchdb, 'Welcome');
        test.done();
    });
};

exports['request as admin'] = function (test) {
    var api = new PluginAPI(COUCH);
    api.request('GET', '/_users/_all_docs', {}, function (err, data, res) {
        if (err) {
            return test.done(err);
        }
        test.equal(res.statusCode, 200);
        test.done();
    });
};
