var couchr = require('couchr'),
    url = require('url');


var PluginAPI = exports.PluginAPI = function PluginAPI(opt) {
    this.url = opt.url;
};

PluginAPI.prototype._resolve = function (path) {
    return url.resolve(this.url, path);
};

PluginAPI.prototype.request = function (method, path, opt, callback) {
    return couchr.request(method, this._resolve(path), opt.data, opt, callback);
};
