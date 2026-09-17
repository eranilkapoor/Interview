# CRUD Operations

MongoDB's CRUD API mirrors the four basic data operations — create, read, update, delete — but expressed as document-shaped operations rather than SQL statements. Writes come in singular and plural forms (`insertOne`/`insertMany`, `updateOne`/`updateMany`, `deleteOne`/`deleteMany`), and reads center on `find`, which takes a query filter document and an optional projection document. Where SQL expresses conditions as `WHERE column = value`, MongoDB expresses them as a filter object whose keys are field names and whose values are either literal matches or operator expressions like `$gt`, `$in`, or `$regex`. This query-as-data-structure design is what makes MongoDB queries easy to build programmatically — a filter is just a JavaScript/BSON object, not a string to concatenate.

Updates default to touching only the fields you explicitly name, using update operators (`$set`, `$unset`, `$inc`, `$push`, etc.) rather than replacing the whole document. This is a meaningful difference from naively doing "read the whole document, modify it in the application, write the whole document back," which is both slower and prone to lost-update races if two clients do it concurrently. `updateOne`/`updateMany` with `$set` should be the default reflex for partial updates; `replaceOne` exists for the rarer case where you genuinely want to overwrite an entire document's contents (short of `_id`).

A detail that trips up people coming from other databases: `deleteOne`/`updateOne` without an explicit sort order will remove/modify whichever single matching document the storage engine encounters first — there's no implicit "first by insertion order" guarantee unless you sort. And a filter that matches nothing is not an error; `deleteOne`/`updateOne`/`updateMany` simply report zero documents modified, so error handling has to check the result's `matchedCount`/`modifiedCount`/`deletedCount` rather than expecting an exception.

## Examples

```js
// Create — insertOne for a single document, insertMany for a batch
db.users.insertOne({ name: "Jane Doe", email: "jane@example.com", age: 29, tags: ["admin"] });

db.users.insertMany([
  { name: "Bob Smith", email: "bob@example.com", age: 34 },
  { name: "Alice Ray", email: "alice@example.com", age: 41 }
]);
```

```js
// Read — query operators for conditions beyond simple equality
db.users.find({ age: { $gt: 30 } });                       // greater than
db.users.find({ tags: { $in: ["admin", "moderator"] } });  // value in a set
db.users.find({ email: { $regex: /^a/, $options: "i" } }); // pattern match, case-insensitive
db.users.find({ age: { $gt: 25 } }, { name: 1, email: 1, _id: 0 }) // projection
         .sort({ age: -1 })
         .limit(10);
```

```js
// Update and Delete — $set touches only named fields; deletes take a filter
db.users.updateOne(
  { email: "jane@example.com" },
  { $set: { age: 30 }, $push: { tags: "verified" } }
);

db.users.updateMany(
  { age: { $lt: 18 } },
  { $set: { status: "minor" } }
);

db.users.deleteOne({ email: "bob@example.com" });
db.users.deleteMany({ status: "inactive" });
```

## Common Pitfalls / Gotchas

- Using `updateOne`/`deleteOne` when you actually meant `updateMany`/`deleteMany` (or vice versa) — `*One` variants silently touch only a single matching document, which can look like the operation "didn't work" when it actually worked on the wrong scope.
- Passing a full replacement document to `updateOne` instead of using `$set` — without an update operator, MongoDB treats the second argument as a full document replacement (`replaceOne` semantics), silently dropping every field you didn't include.
- Forgetting that a query with no matches isn't an error — code that assumes `updateOne`/`deleteOne` throwing means "not found" will miss real failures; check `matchedCount`/`deletedCount` on the result object instead.
- Building filters with unsanitized user input as raw operator keys (e.g., letting a client supply `{ $where: ... }` or arbitrary operator objects) — this is MongoDB's version of injection risk and needs the same input validation discipline as parameterized SQL.
- Relying on `find()` returning documents in insertion order without an explicit `.sort()` — natural order isn't guaranteed, especially after updates, deletes, or on a sharded cluster.

## Interview Questions & Answers

**Q: What's the difference between `updateOne` with `$set` and `replaceOne`?**
A: `updateOne` with `$set` modifies only the fields named in the update document, leaving everything else in the matched document untouched. `replaceOne` (or `updateOne` called without an update operator) replaces the entire document's contents except `_id` — any field not included in the replacement document is dropped.

**Q: How do you query for documents where a field is within a set of values, or greater than a threshold?**
A: Use query operators inside the filter: `{ field: { $in: [v1, v2] } }` for "value is one of these," and `{ field: { $gt: value } }` (or `$gte`/`$lt`/`$lte`) for comparisons. These compose with logical operators like `$and`/`$or` for multi-condition filters.

**Q: What happens if `deleteOne` or `updateOne` doesn't match any document?**
A: No error is thrown. The operation completes normally and the result object reports zero affected documents (`deletedCount: 0` or `matchedCount: 0`), so application code must check those fields explicitly rather than relying on exception handling to detect "not found."

**Q: Why prefer update operators like `$set` over reading a document into the application, modifying it, and writing it back?**
A: Update operators apply atomically on the server and only touch the fields specified, avoiding both the extra round trip of a read-modify-write cycle and the race condition where a concurrent write between your read and your write gets silently overwritten (a classic lost update).

**Q: How would you find users older than 25, return only their name and email, sorted by age descending, limited to 10?**
A: `db.users.find({ age: { $gt: 25 } }, { name: 1, email: 1, _id: 0 }).sort({ age: -1 }).limit(10)` — the filter selects matching documents, the projection document controls which fields come back, and `.sort()`/`.limit()` chain onto the cursor.

## Related Topics
- [documents-and-collections.md](./documents-and-collections.md)
- [indexes.md](./indexes.md)
- [aggregation-pipeline.md](./aggregation-pipeline.md)
- [transactions.md](./transactions.md)
