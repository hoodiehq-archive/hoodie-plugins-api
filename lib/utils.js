exports.wrapPouchCallback = function (callback) {
    return function (err, data) {
        if (err) {
            if (!(err instanceof Error)) {
                var e = new Error(err.reason || err.error);
                for (var k in err) {
                    if (err.hasOwnProperty(k)) {
                        e[k] = err[k];
                    }
                }
                var args = Array.prototype.slice.call(arguments, 1);
                return callback.apply(this, [e].concat(args));
            }
        }
        var parsed = data;
        if (data && data instanceof Buffer) {
            // TODO: why is this a SlowBuffer instead of an object?
            // for now, try to parse as JSON
            try {
                parsed = JSON.parse(data.toString());
            }
            catch (e) {
                parsed = data;
            }
        }
        var args = Array.prototype.slice.call(arguments, 2);
        return callback.apply(this, [err, parsed].concat(args));
    };
};
