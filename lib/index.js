var url = require('url'),
    couchdb_adapter = require('./couchdb'),
    pouchdb_adapter = require('./pouchdb');


/* API
two clients? one for stream responses through web api, the other
wraps that in a nice callback json parsing style for workers to use?

Create this API for both CouchDb and PouchDB (backed by leveldb)

init(db_url/opts) // creates required dbs / ddocs
client(opts)
    databases
        add(name)
        remove(name)
        info(name)
        head(name) // streaming req client only
        exists(name) // worker wrapper only
        list()
        grantReadAccess(db, user(s)) // using user.id (not same as name)
        revokeReadAccess(db, user(s))
        grantWriteAccess(db, user(s))
        revokeWriteAccess(db, user(s))
        hasReadAccess(db, user)
        hasWriteAccess(db, user)
        publish(db) // make public
        unpublish(db) // make not public
        isPublic(db)
        // compact?
        changes() // add, update, remove dbs
    users
        add(name, password)
        remove(name)
        changePassword(password)
        changeUsername(name)
        authenticate(name, password) // => true/false
        get(name) // returns info on their db / hash / etc
        changes() // add, update, remove users
    // handled by www layer instead?
    // sessions
    //    getToken(username, password)
    //    getUser(token)
    replicator
        // ... ?
    tasks
        subscribe(type)
        unsubscribe(type)
    docs
        all(db)
        save(db, doc)
        remove(db, id)
        get(db, id)
        saveBulk(db, docs) // overload save() instead?
        getBulk(db, ids) // overload get() instead?
        changes(db) // add, update, remove docs
*/




module.exports = function (options, callback) {
    try {
        exports.validateOptions(options);
    }
    catch (e) {
        return callback(e);
    }
    var protocol = url.parse(options.db).protocol;
    if (protocol === 'https:' || protocol === 'http:') {
        couchdb_adapter(options, callback);
    }
    else if (protocol === 'leveldb:') {
        pouchdb_adapter(options, callback);
    }
    else {
        return callback(new Error(
            'Unknown protocol for options.db: ' + protocol
        ));
    }
};

exports.validateOptions = function (options) {
    if (!options.db) {
        throw new Error('Missing database location in options.db');
    }
    if (!options.app_id) {
        throw new Error('Missing app id in options.app_id');
    }
    if (!options.users_db) {
        throw new Error('Missing users database location in options.users_db');
    }
};
