/**
 * Dependencies
 */

var events = require('events');


/**
 * API for listening to task document changes
 */

exports.TasksAPI = function (hoodie) {
    var task_events = new events.EventEmitter();

    return function (name) {
        return {
            on: function (ev, fn) {
                return task_events.on(ev + ':' + name, fn);
            },
            emit: function (ev /* ... */) {
                var args = Array.prototype.slice.call(arguments, 1);
                return task_events.emit.apply(
                    task_events, [ev + ':' + name].concat(args)
                );
            }
        };
    };
};
