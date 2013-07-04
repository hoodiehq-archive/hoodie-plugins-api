var MultiCouch = require('multicouch'),
    child_process = require('child_process'),
    request = require('request'),
    mkdirp = require('mkdirp'),
    rimraf = require('rimraf'),
    async = require('async');


var USER = 'admin';
var PASS = 'password';
var COUCH_PORT = 8985;
var COUCH_BASE_URL = 'http://localhost:' + COUCH_PORT;
var COUCH_URL = 'http://' + USER + ':' + PASS + '@localhost:' + COUCH_PORT;
var data_dir = __dirname + '/data';


exports.setupCouch = function (opts, callback) {
    console.log('Killing any old CouchDB instances');
    var cmd = 'pkill -fu ' + process.env.LOGNAME + ' ' + data_dir;

    child_process.exec(cmd, function (err, stdout, stderr) {

        console.log('Starting CouchDB...\n');
        var that = this;

        async.series([
            async.apply(rimraf, opts.data_dir),
            async.apply(mkdirp, opts.data_dir),
            async.apply(startCouch, opts),
            async.apply(createAdmin, opts)
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
            callback(null, couch);
        });
    });
}

function startCouch(opts, callback) {
    // MultiCouch config object
    var couch_cfg = {
        port: opts.port,
        prefix: opts.data_dir,
        couchdb_path: '/usr/bin/couchdb',
        default_sys_ini: '/etc/couchdb/default.ini',
        respawn: false // otherwise causes problems shutting down
    };
    // starts a local couchdb server using the Hoodie app's data dir
    var couchdb = new MultiCouch(couch_cfg);
    // local couchdb has started
    couchdb.on('start', function () {
        // give it time to be ready for requests
        pollCouch(opts, couchdb, function (err) {
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

function createAdmin(opts, callback) {
    request({
        url: opts.base_url + '/_config/admins/' + opts.name,
        method: 'PUT',
        body: JSON.stringify(opts.pass)
    }, callback);
}

function pollCouch(opts, couchdb, callback) {
    function _poll() {
        var options = {
            url: opts.base_url + '/_all_dbs',
            json: true
        };
        request(options, function (err, res, body) {
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
