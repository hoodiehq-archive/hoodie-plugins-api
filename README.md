# API


## HoodieDB(options, callback)

Creates a new db client instance to talk to the backend database. In the
case of Hoodie modules, you won't need to call this as you will be passed
an instance already set up for the application.

__Options__

* __db__ - Database location / CouchDB URL
* __app\_id__ - unique identification for the app

__Returns__

A `hoodie` instance, as used in below APIs.


## Databases

### hoodie.databases.add(name, callback)

Creates a new database with the given name.

### hoodie.databases.remove(name, callback)

Deletes the named database.

### hoodie.databases.info(name, callback)

Provides information on the given database.

### hoodie.databases.list(callback)

Returns a list of all databases related to the app.


## Docs

### hoodie.docs.all(db, callback)

Lists all documents in the database.

### hoodie.docs.save(db, doc, callback)

Saves `doc` to `db`. If the doc has no `_id` property then a new doc is
created and the id is generated for you. Otherwise, it will either create
a new doc with the given id, or it will update an existing document with
that id.
