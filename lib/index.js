var couchr = require('couchr'),
    url = require('url');


var uc = encodeURIComponent;


var PluginAPI = exports.PluginAPI = function PluginAPI(opt) {
    var parsed = url.parse(opt.url);
    parsed.auth = opt.user + ':' + opt.pass;
    this.url = url.format(parsed);
    this.database = new DatabaseAPI(this);
};

PluginAPI.prototype._resolve = function (path) {
    return url.resolve(this.url, path);
};

PluginAPI.prototype.request = function (method, path, opt, callback) {
    return couchr.request(method, this._resolve(path), opt.data, opt, callback);
};


function DatabaseAPI(api) {
    this.api = api;
};

DatabaseAPI.prototype.add = function (name, callback) {
    this.api.request('PUT', '/' + uc(name), {data: ''}, callback);
};

DatabaseAPI.prototype.remove = function (name, callback) {
    this.api.request('DELETE', '/' + uc(name), {}, callback);
};

DatabaseAPI.prototype.findAll = function (callback) {
    this.api.request('GET', '/_all_dbs', {}, function (err, data, res) {
        if (err) {
            return callback(err);
        }
        var dbs = data.filter(function (db) {
            return db[0] !== '_';
        });
        return callback(null, dbs, res);
    });
};
