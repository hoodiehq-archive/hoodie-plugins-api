var MultiCouch = require('multicouch'),
    child_process = require('child_process'),
    request = require('request'),
    mkdirp = require('mkdirp'),
    rimraf = require('rimraf'),
    async = require('async'),
    urlParse = require('url').parse;


exports.setupCouch = function (opts, callback) {
    var cmd = 'pkill -fu ' + process.env.LOGNAME + ' ' + opts.data_dir;
    child_process.exec(cmd, function (err, stdout, stderr) {
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
            process.setMaxListeners(100);
            process.on('exit', function (code) {
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
        port: urlParse(opts.url).port,
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
        url: opts.url + '/_config/admins/' + opts.user,
        method: 'PUT',
        body: JSON.stringify(opts.pass)
    }, callback);
}

function pollCouch(opts, couchdb, callback) {
    function _poll() {
        var options = {
            url: opts.url + '/_all_dbs',
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
