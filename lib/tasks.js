/**
 * Dependencies
 */

var events = require('events');


/**
 * API for listening to task document changes
 */

exports.TasksAPI = function (hoodie, options) {
    var task_events = new events.EventEmitter();

    var task = {};

    task.on = function () {
        return task_events.on.apply(task_events, arguments);
    };

    task.emit = function () {
        return task_events.emit.apply(task_events, arguments);
    };

    task.addSource = options.addSource;
    task.removeSource = options.removeSource;

    return task;
};
