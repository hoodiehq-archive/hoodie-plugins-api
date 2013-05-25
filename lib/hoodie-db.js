var http = require('http'),
    https = require('https'),
    url = require('url'),
    request = require('request'),
    _ = require('underscore');


var exports = module.exports = function (options) {
    exports.validateOptions(options);

    function createOptions(opts) {
        opts.url = url.resolve(options.url, opts.url);
        return _.extend({
            auth: {
                user: options.user,
                pass: options.pass
            }
        }, opts);
    }

    return {
        createDatabase: function (name, callback) {
            var opts = {
                url: '/' + encodeURIComponent(options.app_id + '/' + name)
            };
            request.put(createOptions(opts), callback);
        }
    };
};

exports.validateOptions = function (options) {
    if (!options.url) {
        throw new Error('Missing CouchDB URL in options.url');
    }
    if (!options.user) {
        throw new Error('Missing CouchDB _admin username in options.user');
    }
    if (!options.pass) {
        throw new Error('Missing CouchDB _admin password in options.pass');
    }
    if (!options.app_id) {
        throw new Error('Missing app id in options.app_id');
    }
    if (!options.admin_db) {
        throw new Error('Missing app admin db name in options.admin_db');
    }
};
