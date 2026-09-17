# Transactions

A single write to a single document in MongoDB has always been atomic — if you `$set` three fields and `$push` to an array in one `updateOne` call, either all of those changes apply or none do, even though multiple fields are affected. That single-document atomicity, combined with document modeling that embeds related data together, is why MongoDB schemas often don't need transactions at all: if your schema is designed so that the data that must change together lives in one document, a normal write already gives you the atomicity you'd otherwise need a transaction for.

Starting in version 4.0 (for replica sets) and 4.2 (extended to sharded clusters), MongoDB added multi-document ACID transactions, which let you group multiple operations — potentially across multiple documents and multiple collections — into a single unit that either fully commits or fully rolls back, with the same isolation guarantees you'd expect from a relational database transaction. This is implemented through sessions: you start a `ClientSession`, call `startTransaction()`, perform your reads/writes against that session, and then `commitTransaction()` or `abortTransaction()`. Under the hood, MongoDB uses snapshot isolation, and a transaction that spans a replica set is bounded by a default runtime limit (60 seconds by default) since holding an open transaction ties up resources like an open WiredTiger snapshot.

The honest interview framing is: transactions exist for the genuine cases where multi-document atomicity is unavoidable — moving money between two account documents, decrementing inventory on a product document while simultaneously creating an order document, anything where "half applied" is a correctness bug you can't tolerate. But they are not meant to be MongoDB's default write pattern the way `BEGIN`/`COMMIT` often is in a relational app. Reaching for a transaction on every multi-step operation usually signals a schema that should have embedded more, and transactions do carry real overhead (they hold locks/snapshots for longer, and on a sharded cluster they coordinate across shards, which is slower than an unsharded transaction and slower still than a single-document write).

## Examples

```js
// Single-document atomicity — no transaction needed at all.
// Both the $set and $push apply together, or neither does.
db.accounts.updateOne(
  { _id: ObjectId("64f1...") },
  { $set: { lastTransactionAt: new Date() }, $push: { history: "debit:50" } }
);
```

```js
// Multi-document transaction — moving funds between two separate account
// documents genuinely requires both writes to succeed or both to roll back.
const session = db.getMongo().startSession();
session.startTransaction({ readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });

try {
  const accounts = session.getDatabase("bank").accounts;
  accounts.updateOne({ _id: "acct-1" }, { $inc: { balance: -50 } }, { session });
  accounts.updateOne({ _id: "acct-2" }, { $inc: { balance: 50 } }, { session });
  session.commitTransaction();
} catch (err) {
  session.abortTransaction();
  throw err;
} finally {
  session.endSession();
}
```

```js
// Transaction across two different collections — decrement stock and
// create an order atomically; if either write fails, both roll back.
const session = db.getMongo().startSession();
session.startTransaction();
try {
  const inventoryColl = session.getDatabase("shop").inventory;
  const ordersColl = session.getDatabase("shop").orders;

  const result = inventoryColl.updateOne(
    { sku: "SKU-1001", stock: { $gte: 1 } },
    { $inc: { stock: -1 } },
    { session }
  );
  if (result.modifiedCount === 0) throw new Error("Out of stock");

  ordersColl.insertOne({ sku: "SKU-1001", qty: 1, createdAt: new Date() }, { session });
  session.commitTransaction();
} catch (err) {
  session.abortTransaction();
  throw err;
} finally {
  session.endSession();
}
```

## Common Pitfalls / Gotchas

- Reaching for a multi-document transaction as a default habit carried over from relational apps, when a well-designed embedded document would already give you single-document atomicity for free at lower cost.
- Holding a transaction open across slow application logic (external API calls, heavy computation) between the reads and writes — transactions hold resources for their duration and have a default time limit, so long-running application code inside one risks abort and adds latency/lock contention for other operations.
- Forgetting to call `abortTransaction()` on error — an unhandled exception inside a transaction block without an explicit abort can leave the transaction open until it times out, unnecessarily holding resources.
- Assuming pre-4.0 MongoDB, or a standalone (non-replica-set) deployment, supports multi-document transactions — they require a replica set (4.0+) or sharded cluster (4.2+); a standalone `mongod` cannot run them.
- Not setting an appropriate write concern (e.g., `w: "majority"`) on a transaction that must survive a primary failover — without it, a committed transaction could theoretically be rolled back during a replica set election in rare failure scenarios.

## Interview Questions & Answers

**Q: Why does MongoDB not need transactions as often as a relational database does?**
A: Because a single write to a single document is already atomic — every field change in one `updateOne` call applies together or not at all. Since MongoDB schema design favors embedding related data that changes together into one document, the atomicity a relational app would need a transaction for is often already satisfied by ordinary single-document writes.

**Q: When would you actually reach for a multi-document transaction?**
A: When an operation must atomically touch multiple documents (possibly across collections) and "partially applied" would be a real correctness bug — classic examples are transferring a balance between two account documents, or decrementing inventory on one document while creating an order on another, where either both writes must happen or neither should.

**Q: What versions of MongoDB support multi-document ACID transactions, and on what topology?**
A: Multi-document transactions were introduced in 4.0 for replica sets, and extended to sharded clusters in 4.2. A standalone (single-node, non-replica-set) `mongod` does not support them.

**Q: What's the basic mechanics of running a transaction in MongoDB — what does the session API look like?**
A: You open a `ClientSession`, call `startTransaction()`, perform your reads/writes passing that session to each operation, then call `commitTransaction()` to apply everything atomically or `abortTransaction()` to roll it all back — typically wrapped in a try/catch so any error triggers an abort rather than leaving the transaction hanging open.

**Q: What are the tradeoffs of using transactions heavily in MongoDB?**
A: Transactions hold snapshots/locks for their duration, add coordination overhead (especially across shards in a sharded cluster), and have a default runtime limit, so they're slower than single-document writes and can increase contention if overused. Overusing them is often a sign the schema should have embedded more data to get atomicity "for free" instead.

## Related Topics
- [crud-operations.md](./crud-operations.md)
- [schema-design.md](./schema-design.md)
- [replication.md](./replication.md)
- [sharding.md](./sharding.md)
