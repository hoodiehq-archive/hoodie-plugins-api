/**
 * Wraps a callback so that any errors from PouchDB missing a message property
 * will get it updated with the reason or error property from the response.
 *
 * It will also create a real Error instance so we get some kind of useful (ish)
 * stack trace.
 */

exports.wrapPouchErrors = function (callback) {
    return function (err) {
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
        return callback.apply(this, arguments);
    };
};
