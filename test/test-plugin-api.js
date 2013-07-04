var PluginAPI = require('../lib/index').PluginAPI,
    utils = require('./lib/utils');


var COUCH = {
    port: 8985,
    user: 'admin',
    pass: 'password',
    base_url: 'http://localhost:8985',
    auth_url: 'http://admin:password@localhost:8985',
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
    console.log('Stopping CouchDB');
    this.couch.once('stop', function () {
        callback();
    });
    this.couch.stop();
};


exports['my example test'] = function (test) {
    console.log('test ran');
    test.ok(true);
    test.done();
};

exports['my example test2'] = function (test) {
    console.log('test ran');
    test.ok(true);
    test.done();
};
