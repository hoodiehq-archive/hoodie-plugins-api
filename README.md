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

### hoodie.docs.get(db, id, callback)

Gets the doc with the given id from the databaese `db`

### hoodie.docs.remove(db, doc, callback)

Removes `doc` from `db`. The doc should have the latest `_rev` value set,
or this will result in a document update conflict.

### hoodie.doc.changes(db, options, [callback])

Subscribes to a changes feed for a database. If supplied, the callback will
be passed a possible error, and a `feed` object with a `cancel` method. Calling
`feed.cancel()`, will stop listening for new changes.

__Options__

* __include\_docs__: Include the associated document with each change
* __conflicts__: Include conflicts
* __descending__: Reverse the order of the output table
* __filter__: Reference a filter function from a design document to selectively
  get updates
* __since__: Start the results from the change immediately after the given
  sequence number
* __complete__: Function called when all changes have been processed
* __continuous__: Use longpoll feed
* __onChange__: Function called on each change after deduplication (only
  sends the most recent for each document), not called as a callback but
  called as onChange(change).
