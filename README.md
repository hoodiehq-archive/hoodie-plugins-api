# Hoodie Plugin API

```javascript
// Initializing a worker
module.exports = function (hoodie, callback) {
    // hoodie object is client to hoodie backend, documented below.
    // call callback when setup complete (with optional error if worker failed to initialize).
    // ...
};


// make HTTP requests directly to CouchDB (ideally, you would
never need to use this)
hoodie.request(method, path, options, callback)

// list all databases
hoodie.database.findAll(callback)

// create a new database
hoodie.database.add(name, callback)

// remove a database
hoodie.database.remove(name, callback)

// get a database object to make calls against
hoodie.database(name) => db

// add a document to db
db.add(type, attrs, callback)

// update a document in db
db.update(type, id, changed_attrs, callback)

// get a document from db
db.find(type, id, callback)

// get all documents from db
db.findAll(callback)

// get all documents of a single type in db
db.findAll(type, callback)

// remove a document from db
db.remove(type, id, callback)

// remove all documents of type in db
db.removeAll(type, callback)

// grant read access to everyone on db by updating CouchDB
security
db.grantReadAccess(callback)

// grant read access to specific users on db by updating
CouchDB security
db.grantReadAccess(users, callback)

// grant write access to specific users on db by adding role
(checked by design doc in db)
db.grantWriteAccess(users, callback)

// update db security so it's no longer publicly readable
db.revokeReadAccess(callback)

// remove users from couchdb readers for db
db.revokeReadAccess(users, callback)

// remove role from users so they cannot write to db (checked
by design doc)
db.revokeWriteAccess(users, callback)

// creates new design doc with CouchDB view on db
db.addIndex(name, {map: .., reduce: ..}, callback)

// removes design doc for couchdb view on db
db.removeIndex(name, callback)

// query a couchdb view on db
db.query(index, options, callback)

// list all users
hoodie.user.list(callback)

// get a user object to make calls against
hoodie.user(username) => user

// delete couchdb user
user.remove(callback)

// get user doc
user.get(callback)

// listen to task document events
hoodie.task('email').on('add', function (db, doc) { ... })
hoodie.task('email').on('update', function (db, doc) { ... })
hoodie.task('email').on('remove', function (db, doc) { ... })
```
